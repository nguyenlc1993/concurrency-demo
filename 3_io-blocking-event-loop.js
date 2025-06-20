const timers = require("timers/promises");
const fs = require("fs");

const text = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n';

async function printWithDelay(signal) {
  let counter = 0;
  for await (const _ of timers.setInterval(100, null, {signal})) {
    console.log(`ALIVE ${++counter}`);
  }
}

function blockingIO() {
  for (let i = 0; i < 100000; i++) {
    fs.appendFileSync('test.txt', text);
  }
  fs.unlinkSync('test.txt');
  console.log('blockingIO completed');
}

async function main() {
  await Promise.all([
    printWithDelay(),
    blockingIO(),
  ]);
}

main();