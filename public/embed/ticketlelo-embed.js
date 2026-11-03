/**
 * TicketLelo Official Embed & Checkout Button SDK
 * Automatically binds to .ticketlelo-register-button, .ticketlelo-checkout--button,
 * and elements with data-event-id or data-ticketlelo-action="checkout",
 * opening the fast registration modal overlay.
 */
(function (window, document) {
  "use strict";

  function initCheckoutButtons() {
    var buttons = document.querySelectorAll(
      '.ticketlelo-register-button, .ticketlelo-checkout--button, [data-ticketlelo-action="checkout"], [data-event-id], .luma-checkout--button'
    );

    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      if (btn.getAttribute("data-tl-bound")) continue;
      btn.setAttribute("data-tl-bound", "true");

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var targetEventId =
          this.getAttribute("data-event-id") ||
          this.getAttribute("data-ticketlelo-event-id") ||
          this.getAttribute("data-luma-event-id") ||
          "";
        var href = this.getAttribute("href") || "";

        // Modal overlay
        var overlay = document.createElement("div");
        overlay.id = "ticketlelo-modal-overlay";
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100vw";
        overlay.style.height = "100vh";
        overlay.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
        overlay.style.backdropFilter = "blur(4px)";
        overlay.style.zIndex = "999999";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.padding = "16px";

        var container = document.createElement("div");
        container.style.width = "100%";
        container.style.maxWidth = "780px";
        container.style.height = "88vh";
        container.style.backgroundColor = "#1A1C1F";
        container.style.borderRadius = "20px";
        container.style.overflow = "hidden";
        container.style.boxShadow = "0 25px 50px -12px rgba(0, 0, 0, 0.5)";
        container.style.position = "relative";
        container.style.border = "1px solid #2A2D31";

        var closeBtn = document.createElement("button");
        closeBtn.innerHTML = "&times;";
        closeBtn.style.position = "absolute";
        closeBtn.style.top = "12px";
        closeBtn.style.right = "14px";
        closeBtn.style.width = "32px";
        closeBtn.style.height = "32px";
        closeBtn.style.borderRadius = "8px";
        closeBtn.style.border = "none";
        closeBtn.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
        closeBtn.style.color = "#FFFFFF";
        closeBtn.style.fontSize = "22px";
        closeBtn.style.lineHeight = "1";
        closeBtn.style.cursor = "pointer";
        closeBtn.style.zIndex = "10";

        closeBtn.onclick = function () {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        };

        var iframe = document.createElement("iframe");
        var src = href;
        if (!src || src.indexOf("http") !== 0) {
          src = window.location.origin + "/embed/" + encodeURIComponent(targetEventId);
        }
        iframe.src = src;
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
        iframe.allow = "payment";

        container.appendChild(closeBtn);
        container.appendChild(iframe);
        overlay.appendChild(container);
        document.body.appendChild(overlay);

        overlay.addEventListener("click", function (evt) {
          if (evt.target === overlay) {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          }
        });
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCheckoutButtons);
  } else {
    initCheckoutButtons();
  }

  window.addEventListener("load", initCheckoutButtons);
})(window, document);
