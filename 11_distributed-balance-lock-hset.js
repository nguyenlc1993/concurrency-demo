"use strict";

const crypto = require("crypto");
const timers = require("timers/promises");
const { Redis } = require("ioredis");

const LOCK_EXPIRE_TIME_SECONDS = 5;

const redis = new Redis({
  host: "localhost",
  port: 6378,
  db: 0,
  lazyConnect: true,
});

redis.defineCommand("getLockedBalanceKeyRange", {
  numberOfKeys: 1,
  lua: `
    local pattern = KEYS[1]
    local keys = redis.call('keys', pattern)
    local total = 0

    for _, key in ipairs(keys) do
      local value = redis.call('get', key)
      if value then
        total = total + tonumber(value)
      end
    end

    return total
  `,
});

redis.defineCommand("clearLockBalanceHistoryKeyRange", {
  numberOfKeys: 1,
  lua: `
    local pattern = KEYS[1]
    local keys = redis.call('keys', pattern)
    for _, key in ipairs(keys) do
      redis.call('del', key)
    end
    return 'OK'
  `,
});

redis.defineCommand("getLockedBalanceHset", {
  numberOfKeys: 1,
  lua: `
    local key = KEYS[1]
    local data = redis.call('hgetall', key)
    local total = 0
    for i, v in ipairs(data) do
      if i % 2 == 0 then
        total = total + tonumber(v)
      end
    end
    return total
  `,
});

redis.defineCommand("registerLockedBalanceHset", {
  numberOfKeys: 1,
  lua: `
    local key = KEYS[1]
    local uuid = ARGV[1]
    local amount = ARGV[2]
    local expire = ARGV[3]
    local result = redis.call('hsetex', key, 'FNX', 'EX', expire, 'FIELDS', 1, uuid, amount)
    local data = redis.call('hgetall', key)
    local total = 0
    for i, v in ipairs(data) do
      if i % 2 == 0 then
        total = total + tonumber(v)
      end
    end
    return {result, total}
  `,
});

redis.defineCommand("unregisterLockedBalanceHset", {
  numberOfKeys: 1,
  lua: `
    local key = KEYS[1]
    local uuid = ARGV[1]
    local result = redis.call('hdel', key, uuid)
    local data = redis.call('hgetall', key)
    local total = 0
    for i, v in ipairs(data) do
      if i % 2 == 0 then
        total = total + tonumber(v)
      end
    end
    return {result, total}
  `,
});

const lockedAmountArray = Array.from({ length: 1000 }, (_, i) => i + 1);

async function randomDelay() {
  await timers.setTimeout(Math.floor(Math.random() * 100));
}

async function longDelay() {
  await timers.setTimeout(LOCK_EXPIRE_TIME_SECONDS * 1000 + 100);
}

// ---- Lock balance with SET (slow and does not return current balance correctly) ----

async function registerLockedBalance(userId, amount) {
  const uuid = crypto.randomUUID();
  const newBalance = await redis.set(
    `locked_balance_history:${userId}:${uuid}`,
    amount,
    "EX",
    LOCK_EXPIRE_TIME_SECONDS,
    "NX"
  );
  return { uuid, newBalance };
}

async function unregisterLockedBalance(userId, uuid) {
  const deleted = await redis.del(`locked_balance_history:${userId}:${uuid}`);
  return deleted > 0;
}

async function getLockedBalance(userId) {
  const result = await redis.getLockedBalanceKeyRange(
    `locked_balance_history:${userId}:*`
  );
  return parseInt(result) || 0;
}

async function clearLockBalanceHistory(userId) {
  await redis.clearLockBalanceHistoryKeyRange(
    `locked_balance_history:${userId}:*`
  );
}

async function testLockBalanceKeyRange() {
  try {
    await redis.connect();
    const userId = "1";
    await clearLockBalanceHistory(userId);
    await Promise.all(
      lockedAmountArray.map(async (amount) => {
        await randomDelay();
        const { uuid, newBalance } = await registerLockedBalance(
          userId,
          amount
        );
        console.log(
          `Locked ${amount} for user ${userId}. Current locked balance: ${newBalance}`
        );
        await randomDelay();
        const deleted = await unregisterLockedBalance(userId, uuid);
        const currentBalance = await getLockedBalance(userId);
        if (deleted) {
          console.log(
            `Unlocked ${amount} for user ${userId}. Current locked balance: ${currentBalance}`
          );
        } else {
          console.log(
            `Expired ${amount} for user ${userId}. Current locked balance: ${currentBalance}`
          );
        }
      })
    );
    const finalBalance = await getLockedBalance(userId);
    console.log(`Final balance: ${finalBalance}`);
  } finally {
    await redis.quit();
  }
}

// ---- Lock balance with Lua script utilizing hash set (fast, atomic and returns current balance correctly) ----

async function registerLockedBalanceHset(userId, amount) {
  const uuid = crypto.randomUUID();
  const [setCount, totalBalance] = await redis.registerLockedBalanceHset(
    `locked_balance_history_hset:${userId}`,
    uuid,
    amount,
    LOCK_EXPIRE_TIME_SECONDS
  );
  return { uuid, success: setCount > 0, totalBalance };
}

async function unregisterLockedBalanceHset(userId, uuid) {
  const [deleteCount, totalBalance] = await redis.unregisterLockedBalanceHset(
    `locked_balance_history_hset:${userId}`,
    uuid
  );
  return { success: deleteCount > 0, totalBalance };
}

async function getLockedBalanceHset(userId) {
  const result = await redis.getLockedBalanceHset(
    `locked_balance_history_hset:${userId}`
  );
  return parseInt(result) || 0;
}

async function clearLockBalanceHistoryHset(userId) {
  await redis.del(`locked_balance_history_hset:${userId}`);
}

async function testLockBalanceHset() {
  try {
    await redis.connect();
    const userId = "1";
    await clearLockBalanceHistoryHset(userId);
    await Promise.all(
      lockedAmountArray.map(async (amount) => {
        await randomDelay();
        let { uuid, success, totalBalance } = await registerLockedBalanceHset(
          userId,
          amount
        );
        if (success) {
          console.log(
            `Locked ${amount} for user ${userId}. Current locked balance: ${totalBalance}`
          );
        } else {
          console.log(
            `Already locked ${amount} for user ${userId}. Current locked balance: ${totalBalance}`
          );
        }
        await randomDelay();
        ({ success, totalBalance } = await unregisterLockedBalanceHset(
          userId,
          uuid
        ));
        if (success) {
          console.log(
            `Unlocked ${amount} for user ${userId}. Current locked balance: ${totalBalance}`
          );
        } else {
          console.log(
            `Already expired ${amount} for user ${userId}. Current locked balance: ${totalBalance}`
          );
        }
      })
    );
    const finalBalance = await getLockedBalance(userId);
    console.log(`Final balance: ${finalBalance}`);
  } finally {
    await redis.quit();
  }
}

async function testLockBalanceHsetSimple() {
  try {
    await redis.connect();
    const userId = "1";
    const amount = 1000;
    await clearLockBalanceHistoryHset(userId);
    let start = performance.now();
    let { uuid, success, totalBalance } = await registerLockedBalanceHset(
      userId,
      amount
    );
    console.log(`registerLockedBalanceHset took ${performance.now() - start}ms`);
    if (success) {
      console.log(
        `Locked ${amount} for user ${userId}. Current locked balance: ${totalBalance}`
      );
    } else {
      console.log(
        `Already locked ${amount} for user ${userId}. Current locked balance: ${totalBalance}`
      );
    }
    start = performance.now();
    ({ success, totalBalance } = await unregisterLockedBalanceHset(
      userId,
      uuid
    ));
    console.log(`unregisterLockedBalanceHset took ${performance.now() - start}ms`);
    if (success) {
      console.log(
        `Unlocked ${amount} for user ${userId}. Current locked balance: ${totalBalance}`
      );
    } else {
      console.log(
        `Already expired ${amount} for user ${userId}. Current locked balance: ${totalBalance}`
      );
    }
    const finalBalance = await getLockedBalance(userId);
    console.log(`Final balance: ${finalBalance}`);
  } finally {
    await redis.quit();
  }
}

testLockBalanceHset();
