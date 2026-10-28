/**
 * TicketLelo External Website Embed SDK (P13, EMBED-001–015)
 * Enables partner colleges, event websites, and creators to seamlessly embed
 * official TicketLelo registration widgets on any external webpage.
 */

(function (window, document) {
  "use strict";

  var TicketLeloEmbed = {
    version: "1.0.0",
    instances: {},

    /**
     * Initializes an embed iframe in the target container
     * @param {Object} options
     * @param {string} options.eventId - Target event ID or slug
     * @param {string|HTMLElement} options.container - Selector or DOM node
     * @param {string} [options.referralCode] - Campus ambassador referral code
     * @param {string} [options.theme] - "light" | "dark"
     * @param {function} [options.onSuccess] - Callback on ticket issuance
     */
    init: function (options) {
      if (!options || !options.eventId) {
        console.error("[TicketLeloEmbed] eventId is required.");
        return null;
      }

      var container =
        typeof options.container === "string"
          ? document.querySelector(options.container)
          : options.container;

      if (!container) {
        console.error("[TicketLeloEmbed] Container element not found:", options.container);
        return null;
      }

      var instanceId = "tl-embed-" + options.eventId + "-" + Math.random().toString(36).substring(2, 7);

      // Collect URL search params from host page (UTM tags + referral)
      var hostParams = new URLSearchParams(window.location.search);
      var embedParams = new URLSearchParams();

      if (options.referralCode) embedParams.set("ref", options.referralCode);
      else if (hostParams.get("ref")) embedParams.set("ref", hostParams.get("ref"));

      ["utm_source", "utm_medium", "utm_campaign", "utm_content"].forEach(function (key) {
        if (hostParams.get(key)) embedParams.set(key, hostParams.get(key));
      });

      if (options.theme) embedParams.set("theme", options.theme);

      // Construct Embed URL
      var scriptSrc = "";
      var scripts = document.getElementsByTagName("script");
      for (var i = 0; i < scripts.length; i++) {
        if (scripts[i].src && scripts[i].src.indexOf("/sdk/embed.js") !== -1) {
          scriptSrc = scripts[i].src;
          break;
        }
      }

      var origin = window.location.origin;
      if (scriptSrc) {
        try {
          var parsedUrl = new URL(scriptSrc);
          origin = parsedUrl.origin;
        } catch (e) {}
      }

      var iframeUrl = origin + "/embed/" + encodeURIComponent(options.eventId);
      var qs = embedParams.toString();
      if (qs) iframeUrl += "?" + qs;

      // Create responsive iframe wrapper
      var wrapper = document.createElement("div");
      wrapper.id = instanceId;
      wrapper.className = "ticketlelo-embed-wrapper";
      wrapper.style.width = "100%";
      wrapper.style.maxWidth = "720px";
      wrapper.style.margin = "0 auto";
      wrapper.style.position = "relative";
      wrapper.style.borderRadius = "16px";
      wrapper.style.overflow = "hidden";
      wrapper.style.boxShadow = "0 8px 30px rgba(0, 0, 0, 0.08)";

      var iframe = document.createElement("iframe");
      iframe.src = iframeUrl;
      iframe.title = "TicketLelo Event Registration";
      iframe.width = "100%";
      iframe.height = "520";
      iframe.style.border = "none";
      iframe.style.display = "block";
      iframe.style.transition = "height 0.25s ease-in-out";
      iframe.allow = "payment";

      wrapper.appendChild(iframe);
      container.innerHTML = "";
      container.appendChild(wrapper);

      // Listen for postMessage height resizing & checkout events
      var handleMessage = function (event) {
        if (event.origin !== origin || event.source !== iframe.contentWindow) return;
        if (!event.data || typeof event.data !== "object") return;
        if (event.data.type === "ticketlelo:resize" && event.data.height) {
          var height = Number(event.data.height);
          if (Number.isFinite(height) && height > 0) iframe.style.height = Math.min(10000, Math.max(300, height)) + "px";
        }
        if (event.data.type === "ticketlelo:success" && typeof options.onSuccess === "function") {
          options.onSuccess(event.data.ticket);
        }
      };

      window.addEventListener("message", handleMessage);

      var instance = {
        id: instanceId,
        iframe: iframe,
        destroy: function () {
          window.removeEventListener("message", handleMessage);
          if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
        },
      };

      TicketLeloEmbed.instances[instanceId] = instance;
      return instance;
    },

    /**
     * Auto-discovers and initializes embeds marked with data-ticketlelo-event
     */
    autoInit: function () {
      var elements = document.querySelectorAll("[data-ticketlelo-event]");
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        var eventId = el.getAttribute("data-ticketlelo-event");
        var referralCode = el.getAttribute("data-ticketlelo-ref");
        var theme = el.getAttribute("data-ticketlelo-theme");

        TicketLeloEmbed.init({
          eventId: eventId,
          container: el,
          referralCode: referralCode,
          theme: theme,
        });
      }
    },
  };

  window.TicketLeloEmbed = TicketLeloEmbed;

  // Auto-init on DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", TicketLeloEmbed.autoInit);
  } else {
    TicketLeloEmbed.autoInit();
  }
})(typeof window !== "undefined" ? window : this, typeof document !== "undefined" ? document : {});
