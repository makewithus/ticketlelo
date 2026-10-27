"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getActiveEvents } from "@/lib/firestore";

/**
 * Live events list for the landing page.
 *
 * Rendered with the UI dev's own events-section classes (content.is--events,
 * events_wrapper, event_item, ...) and mounted (via portal) into the
 * #tl-events-root placeholder that scripts/sync-ui.mjs places where the
 * design's events section lives. Clicking a card opens /register/<eventId>,
 * which hosts the existing DynamicRegistrationForm.
 */

const LEFT_STYLE = `
#tl-events-left { display:flex !important; flex-direction:column !important; align-items:flex-start !important; justify-content:flex-start !important; height:auto !important; min-height:0 !important; overflow:visible !important; padding-bottom:0 !important; }
#tl-events-image { position:relative !important; inset:auto !important; overflow:visible !important; width:100% !important; margin-top:16px !important; flex-shrink:0; }
#tl-events-image img { display:block; width:100%; height:auto; transform:none !important; }
`;

import { formatShortDate } from "@/lib/date-utils";

const formatDate = (date) => {
  return formatShortDate(date, "");
};

function EventCard({ event }) {
  return (
    <div role="listitem" className="w-dyn-item">
      <a href={`/register/${event.id}`} className="event_item is--green w-inline-block">
        <div className="event_item-header">
          <div className="event_tags-wrapper">
            <div className="events_tag-1 is--dark">Register Now</div>
            {event.totalTickets !== undefined && (
              <div className="events_tag-2 is--dark">
                {event.totalTickets} tickets
              </div>
            )}
          </div>
          <div className="time-flex">
            <div className="event-date-flex">
              <div className="event_date-text">{formatDate(event.date)}</div>
            </div>
          </div>
        </div>
        <div className="event-item-header">
          <h3 className="event_h">{event.name}</h3>
          <div className="icon-32 w-embed">
            <svg width="100%" height="100%" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M17.7238 26.2762C17.2031 25.7555 17.2031 24.9112 17.7238 24.3905L24.781 17.3334L3.99992 17.3334C3.26354 17.3334 2.66658 16.7364 2.66658 16C2.66658 15.2636 3.26354 14.6667 3.99992 14.6667L24.781 14.6667L17.7238 7.6095C17.2031 7.0888 17.2031 6.24458 17.7238 5.72388C18.2445 5.20318 19.0887 5.20318 19.6094 5.72388L28.9427 15.0572C29.4634 15.5779 29.4634 16.4221 28.9427 16.9428L19.6094 26.2762C19.0887 26.7969 18.2445 26.7969 17.7238 26.2762Z"
                fill="currentColor"
              />
            </svg>
          </div>
        </div>
        <div className="events_speakers-wrap">
          <div className="event_speaker-content">
            <div className="event_speaker-info">
              <p>{event.location}</p>
              {event.description && (
                <p className="speaker-position">{event.description}</p>
              )}
            </div>
          </div>
        </div>
      </a>
    </div>
  );
}

function EventsSection({ events, loading }) {
  return (
    <section className="section" id="events">
      <style dangerouslySetInnerHTML={{ __html: LEFT_STYLE }} />
      <div className="container is--events">
        <div className="events">
          <div className="flex-h-4">
            <div id="tl-events-left" className="content is--events">
              <div className="max-width-650" style={{ position: "relative", flexShrink: 0 }}>
                <h2 className="text-color-white">Upcoming Events</h2>
              </div>
              <div id="tl-events-image" className="event_image-mask">
                <img src="/image/ticketboat.png" loading="lazy" alt="" className="events_image" />
              </div>
            </div>
            <div className="events_wrapper">
              <div className="events-future">
                <div className="w-dyn-list">
                  {loading ? (
                    <div className="w-dyn-empty">
                      <div>Loading events...</div>
                    </div>
                  ) : events.length === 0 ? (
                    <div className="w-dyn-empty">
                      <div>No upcoming events found.</div>
                    </div>
                  ) : (
                    <div role="list" className="events_list w-dyn-items">
                      {events.map((event) => (
                        <EventCard key={event.id} event={event} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingEvents() {
  const [mount, setMount] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) {
        setMount(document.getElementById("tl-events-root"));
      }
    }, 0);
    (async () => {
      try {
        const evs = await getActiveEvents();
        if (isMounted) setEvents(evs);
      } catch (error) {
        console.error("Failed to load events:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  if (!mount) return null;
  return createPortal(<EventsSection events={events} loading={loading} />, mount);
}
