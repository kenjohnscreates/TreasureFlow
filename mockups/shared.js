const DEST = "0xA11c00000000000000000000000000000000Pay1";

const HASH = {
  sweep: "0x7c3a91e2b4d0c8f11a9e44b0c03d6e5a91e2b4d0",
  remove: "0x12b4c03d7e5a91e2b4d0c8f11a9e44b07c3a91e2",
  pay: "0x9e8011afc8f11a9e44b07c3a91e2b4d0c03d6e5a",
};

function short(h) {
  return h.slice(0, 6) + "..." + h.slice(-4);
}

function wireDemo() {
  const log = document.getElementById("agent-log");
  const form = document.getElementById("pay-form");
  const input = document.getElementById("pay-input");
  const sweepBtn = document.getElementById("sweep-btn");
  const rejectBtn = document.getElementById("reject-btn");
  const live = document.getElementById("liquid-now");

  function line(role, text) {
    const el = document.createElement("div");
    el.className = "msg " + role;
    el.innerHTML = "<span>" + role + "</span><p>" + text + "</p>";
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const prompt = input.value.trim();
    if (!prompt) return;
    line("you", prompt);
    input.value = "";
    if (/50,?000/.test(prompt)) {
      line(
        "agent",
        "Rejected before signing. 50,000 USDC is over the 10,000 per-call cap. Dynamic policy. Nothing moved.",
      );
      return;
    }
    line(
      "agent",
      "Allowlisted. Under per-call and remaining daily cap. Free USDC 1,200. Shortfall 1,200. Unwinding that much from the USDC/USDT pool, then sending 2,400.",
    );
    line(
      "agent",
      "removeLiquidity " +
        short(HASH.remove) +
        "<br>transfer " +
        short(HASH.pay) +
        "<br>Buffer state: 0 USDC liquid. Next sweep waits until liquid is back above 25,000.",
    );
    if (live) live.textContent = "0.00";
  });

  sweepBtn.addEventListener("click", () => {
    line(
      "agent",
      "Manual sweep. Surplus above buffer is 0 (liquid 1,200, buffer 25,000). No addLiquidity. Last completed sweep at 02:00: " +
        short(HASH.sweep),
    );
  });

  rejectBtn.addEventListener("click", () => {
    input.value = "send 50,000 USDC to " + DEST;
    form.requestSubmit();
  });
}

document.addEventListener("DOMContentLoaded", wireDemo);
