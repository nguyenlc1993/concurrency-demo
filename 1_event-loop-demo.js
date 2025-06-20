console.log("1. Script starts - synchronous execution");

// Microtask 1: Promise
Promise.resolve().then(() => {
  console.log("2. Promise microtask executed");
});

// Microtask 2: process.nextTick (highest priority)
process.nextTick(() => {
  console.log("3. process.nextTick microtask executed");
});

// Timer 1: setTimeout with 0ms delay
setTimeout(() => {
  console.log("4. setTimeout 0ms timer executed");

  // Nested microtask inside timer
  Promise.resolve().then(() => {
    console.log("5. Nested Promise microtask inside setTimeout");
  });

  process.nextTick(() => {
    console.log("6. Nested process.nextTick inside setTimeout");
  });
}, 0);

// Timer 2: setImmediate
setImmediate(() => {
  console.log("7. setImmediate executed");

  // Nested microtask inside setImmediate
  Promise.resolve().then(() => {
    console.log("8. Nested Promise microtask inside setImmediate");
  });
});

// Timer 3: setTimeout with longer delay
setTimeout(() => {
  console.log("9. setTimeout 100ms timer executed");
}, 100);

// I/O operation simulation
const fs = require("fs");
fs.readFile(__filename, () => {
  console.log("10. File read I/O callback executed");

  // Nested timers inside I/O callback
  setTimeout(() => {
    console.log("11. setTimeout inside I/O callback");
  }, 0);

  setImmediate(() => {
    console.log("12. setImmediate inside I/O callback");
  });
});

console.log("13. Script ends - synchronous execution complete");

// Additional demonstration of microtask queue behavior
Promise.resolve().then(() => {
  console.log("14. Another Promise microtask");

  // This will be executed in the same microtask phase
  Promise.resolve().then(() => {
    console.log("15. Nested Promise in microtask phase");
  });
});

process.nextTick(() => {
  console.log("16. Another process.nextTick");

  // This will also be executed in the same microtask phase
  process.nextTick(() => {
    console.log("17. Nested process.nextTick");
  });
});
