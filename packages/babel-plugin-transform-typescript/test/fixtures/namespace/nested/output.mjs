class A {}

(function (A) {
  let C;

  (function (C) {
    class G {}

    C.G = G;
    const E = C.E = 7;
  })(A.C = C || (C = {}));

  function D() {}

  (function (D) {
    const C = 5;
    let H;

    (function (H) {
      H[H["I"] = 11] = "I";
      H[H["J"] = 13] = "J";
      H[H["K"] = 17] = "K";
    })(H || (H = {}));

    D.H = H;
  })(A.D = D || (D = {}));

  class F {}

  (function (F) {})(F || (F = {}));

  let G;

  (function (G) {})(G || (G = {}));

  let L;

  (function (L) {
    L[L["M"] = 19] = "M";
  })(L || (L = {}));
})(A || (A = {}));
