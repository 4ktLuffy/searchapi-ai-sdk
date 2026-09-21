'use client';

import { useState } from 'react';

import { planTrip, type TripResult } from './actions';

function defaultDate(daysAhead: number): string {
  return new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10);
}

function formatDuration(minutes?: number): string {
  if (!minutes) return '';
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function Page() {
  const [result, setResult] = useState<TripResult | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      setResult(await planTrip(formData));
    } finally {
      setPending(false);
    }
  }

  return (
    <main>
      <h1>Travel research agent</h1>
      <p className="lede">
        Real Google Flights and Google Hotels data, from the same tools an agent would call.
        Built on <code>searchapi-ai-sdk</code>.
      </p>

      <form action={onSubmit}>
        <label>
          From
          <input name="from" defaultValue="JFK" maxLength={4} required />
        </label>
        <label>
          To
          <input name="to" defaultValue="LIS" maxLength={4} required />
        </label>
        <label>
          City for hotels
          <input name="city" defaultValue="Lisbon" required />
        </label>
        <label>
          Depart
          <input name="departureDate" type="date" defaultValue={defaultDate(45)} required />
        </label>
        <label>
          Return
          <input name="returnDate" type="date" defaultValue={defaultDate(48)} required />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? 'Searching…' : 'Plan the trip'}
        </button>
      </form>

      {result?.error ? <p className="error">{result.error}</p> : null}

      {result && !result.error ? (
        <div className="columns">
          <section>
            <h2>
              Flights
              {result.lowestPrice ? (
                <> · <span className="pill">from ${result.lowestPrice}</span></>
              ) : null}
            </h2>
            {result.flights.length === 0 ? <p className="meta">No itineraries found.</p> : null}
            {result.flights.map((flight, index) => (
              <article className="card" key={index}>
                <div className="row">
                  <strong>
                    {flight.legs[0]?.from} → {flight.legs[flight.legs.length - 1]?.to}
                  </strong>
                  <span className="price">{flight.price ? `$${flight.price}` : '—'}</span>
                </div>
                <div className="meta">
                  {formatDuration(flight.totalDurationMinutes)}
                  {' · '}
                  {flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}
                </div>
                {flight.legs.map((leg, legIndex) => (
                  <div className="leg" key={legIndex}>
                    {leg.airline} {leg.flightNumber} · {leg.departure} → {leg.arrival}
                  </div>
                ))}
              </article>
            ))}
          </section>

          <section>
            <h2>Hotels</h2>
            {result.hotels.length === 0 ? <p className="meta">No properties found.</p> : null}
            {result.hotels.map((hotel, index) => (
              <article className="card" key={index}>
                <div className="row">
                  <strong>{hotel.name}</strong>
                  <span className="price">{hotel.pricePerNight ?? '—'}</span>
                </div>
                <div className="meta">
                  {[
                    hotel.hotelClass,
                    hotel.rating ? `${hotel.rating}★ (${hotel.reviews ?? 0})` : undefined,
                    hotel.totalPrice ? `${hotel.totalPrice} total` : undefined,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                {hotel.deal ? <div className="leg"><span className="pill">{hotel.deal}</span></div> : null}
                {hotel.amenities?.length ? (
                  <div className="leg">{hotel.amenities.slice(0, 4).join(' · ')}</div>
                ) : null}
              </article>
            ))}
          </section>
        </div>
      ) : null}

      <footer>
        Needs <code>SEARCHAPI_API_KEY</code> in the environment. Every field shown here comes
        straight from the tools in{' '}
        <a href="https://github.com/4ktLuffy/searchapi-ai-sdk">searchapi-ai-sdk</a>.
      </footer>
    </main>
  );
}
