// sockjs-client가 browser 환경에서 global을 기대하므로 브라우저 window로 채워준다.
if (typeof window !== "undefined" && typeof window.global === "undefined") {
  window.global = window;
}
