# Travel research agent

A small Next.js app that searches real Google Flights and Google Hotels data
through [`searchapi-ai-sdk`](../../README.md).

It calls the same `flightSearch` and `hotelSearch` tool objects an agent would
call, just invoked directly, so the demo runs on a SearchApi key alone with no
model credentials.

```bash
npm install
echo "SEARCHAPI_API_KEY=your-key" > .env.local
npm run dev
```

Then open http://localhost:3100.

Two searches are spent per plan, one for flights and one for hotels.
