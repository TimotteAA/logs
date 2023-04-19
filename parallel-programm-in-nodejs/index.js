const express = require("express");
const { fork } = require("child_process");

const app = express();

app.get("/:num", (req, res) => {
  const num = req.params.num;
  //   res.send(isPrime(num));
  const childProcess = fork("./isPrime.js");
  /**
   * 让子进程计算
   */
  childProcess.send({
    type: "isPrime",
    num,
  });

  //   childProcess.on("error", (err) => {
  //     res.send(err);
  //   });

  childProcess.on("message", ({ type, result }) => {
    console.log(type, result);
    if (type === "error") {
      res.status(400);
      res.send(`${num} is not a number`);
    } else {
      res.send(result);
    }
  });
});

// app.get("", (req, res) => {
//   res.send("sever start");
// });

app.listen(8000, "0.0.0.0", () => {
  console.log("server start at 8000");
});

/**
 * 每当请求来时，fork一个子进程专门用于执行isPrime
 * @param {*} num
 * @returns
 */
// function isPrime(num) {
//   const factors = [];

//   if (num < 1) return false;
//   if (num === 1) return true;

//   for (let i = 2; i < num; i++) {
//     if (num % i === 0) {
//       factors.push(i);
//     }
//   }

//   return { num, factors, isPrime: factors.length > 0 ? false : true };
// }
