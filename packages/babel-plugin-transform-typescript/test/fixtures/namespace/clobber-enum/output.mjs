var A;

(function (A) {
  A[A["C"] = 2] = "C";
})(A || (A = {}));

(function (A) {
  const B = A.B = 1;
})(A || (A = {}));
