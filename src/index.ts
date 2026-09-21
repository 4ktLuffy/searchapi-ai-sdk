export { SearchApiError, type SearchApiConfig } from './client.js';
export { webSearch, newsSearch, scholarSearch, type SearchResult } from './tools/web.js';
export { shoppingSearch, type ShoppingResult } from './tools/commerce.js';
export { mapsSearch, type PlaceResult } from './tools/maps.js';
export {
  flightSearch,
  hotelSearch,
  type FlightLeg,
  type FlightOption,
  type HotelResult,
} from './tools/travel.js';
export { searchApiTool, type SearchApiToolConfig } from './tools/generic.js';
