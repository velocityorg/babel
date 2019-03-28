class A {}

(function (A) {
  const B = A.B = 1;
})(A || (A = {}));
