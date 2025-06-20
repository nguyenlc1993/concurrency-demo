"use strict";

const timers = require("timers/promises");
const { Redis } = require("ioredis");

const redis = new Redis({
  host: "localhost",
  port: 6378,
  db: 0,
  lazyConnect: true,
});

const lockedAmountArray = Array.from({ length: 1000 }, (_, i) => i + 1);

async function randomDelay() {
  await timers.setTimeout(Math.floor(Math.random() * 100));
}

// ---- Lock balance with GET/SET (not atomic) ----

async function clearLockedBalance(userId) {
  await redis.del(`locked_balance:${userId}`);
}

async function getLockedBalance(userId) {
  const balance = await redis.get(`locked_balance:${userId}`);
  return balance ? Number(balance) : 0;
}

async function lockBalanceGetSet(userId, amount) {
  const balance = await redis.get(`locked_balance:${userId}`);
  const newBalance = balance ? Number(balance) + amount : amount;
  await redis.set(`locked_balance:${userId}`, newBalance);
  return newBalance;
}

async function unlockBalanceGetSet(userId, amount) {
  const balance = await redis.get(`locked_balance:${userId}`);
  const newBalance = Math.max(balance ? Number(balance) - amount : 0, 0);
  await redis.set(`locked_balance:${userId}`, newBalance);
  return newBalance;
}

async function testLockBalanceGetSet() {
  try {
    await redis.connect();
    const userId = "1";
    await clearLockedBalance(userId);
    await Promise.all(
      lockedAmountArray.map(async (amount) => {
        await randomDelay();
        let newBalance = await lockBalanceGetSet(userId, amount);
        console.log(`Locked ${amount} for user ${userId}. Current locked balance: ${newBalance}`);
        await randomDelay();
        newBalance = await unlockBalanceGetSet(userId, amount);
        console.log(`Unlocked ${amount} for user ${userId}. Current locked balance: ${newBalance}`);
      })
    );
    const finalBalance = await getLockedBalance(userId);
    console.log(`Final balance: ${finalBalance}`);
  } finally {
    await redis.quit();
  }
}

// ---- Lock balance with INCRBY (atomic) ----

async function lockBalanceIncr(userId, amount) {
  const newBalance = await redis.incrby(`locked_balance:${userId}`, amount);
  return newBalance;
}

async function unlockBalanceIncr(userId, amount) {
  const newBalance = await redis.incrby(`locked_balance:${userId}`, -amount);
  return newBalance;
}

async function testLockBalanceIncr() {
  try {
    await redis.connect();
    const userId = "1";
    await clearLockedBalance(userId);
    await Promise.all(
      lockedAmountArray.map(async (amount) => {
        await randomDelay();
        let newBalance = await lockBalanceIncr(userId, amount);
        console.log(`Locked ${amount} for user ${userId}. Current locked balance: ${newBalance}`);
        await randomDelay();
        newBalance = await unlockBalanceIncr(userId, amount);
        console.log(`Unlocked ${amount} for user ${userId}. Current locked balance: ${newBalance}`);
      })
    );
    const finalBalance = await getLockedBalance(userId);
    console.log(`Final balance: ${finalBalance}`);
  } finally {
    await redis.quit();
  }
}

async function testLockBalanceIncrSimple() {
  try {
    await redis.connect();
    const userId = "1";
    const amount = 1000;
    await clearLockedBalance(userId);
    let start = performance.now();
    let newBalance = await lockBalanceIncr(userId, amount);
    console.log(`lockBalanceIncr took ${performance.now() - start}ms`);
    console.log(`Locked ${amount} for user ${userId}. Current locked balance: ${newBalance}`);
    start = performance.now();
    newBalance = await unlockBalanceIncr(userId, amount);
    console.log(`unlockBalanceIncr took ${performance.now() - start}ms`);
    console.log(`Unlocked ${amount} for user ${userId}. Current locked balance: ${newBalance}`);
    const finalBalance = await getLockedBalance(userId);
    console.log(`Final balance: ${finalBalance}`);
  } finally {
    await redis.quit();
  }
}

testLockBalanceIncrSimple();