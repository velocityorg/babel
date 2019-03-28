class A {}

(function (A) {
  let C;

  (function (C) {
    class G {}

    C.G = G;
    const E = C.E = 8;
  })(A.C = C || (C = {}));

  function D() {}

  (function (D) {
    const C = 5;
  })(A.D = D || (D = {}));

  class F {}

  (function (F) {})(F || (F = {}));

  let G;

  (function (G) {})(G || (G = {}));
})(A || (A = {}));
