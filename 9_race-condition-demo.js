const timers = require("timers/promises");

const counter = { value: 0 };

async function getCounter() {
  await timers.setTimeout(Math.random() * 100);
  return counter.value;
}

async function setCounter(value) {
  await timers.setTimeout(Math.random() * 100);
  counter.value = value;
}

async function increment(value) {
  const currentValue = await getCounter();
  await setCounter(currentValue + value);
  console.log(`Increment of ${value} done.`);
}

async function main() {
  const increments = Array.from({ length: 1000 }, (_, i) => [
    i + 1,
    `A${i + 1}`,
  ]);
  const expectedValue = increments.reduce((acc, [value]) => acc + value, 0);
  await Promise.all(increments.map(([value, label]) => increment(value, label)));
  console.log(`Final Value: ${counter.value}`);
  console.log(`Expected Value: ${expectedValue}`);
  if (counter.value === expectedValue) {
    console.log("OK");
  } else {
    console.log("Race condition detected");
  }
}

main();
