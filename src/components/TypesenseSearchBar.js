import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import debounce from "lodash.debounce";

const TYPESENSE_API_KEY = "ybO2YXQQ7ihNrdP9CnViQgbknjgQ4lxb";
const TYPESENSE_API_URL = "https://j6xk1q0pv2azhw3lp-1.a1.typesense.net";

export default function TypesenseSearchBar({ activePage = "workers", onResults, userLocation }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const debouncedSearch = useRef(
    debounce(async (searchTerm, activePage, userLocation, onResults, setLoading, setError) => {
      if (!searchTerm) {
        onResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        let collectionName;
        switch (activePage) {
          case "workers":
            collectionName = "workers_index";
            break;
          case "services":
            collectionName = "services_index";
            break;
          case "ads":
            collectionName = "ads_index";
            break;
          case "chats":
            collectionName = "chats_index";
            break;
          default:
            collectionName = "workers_index";
        }

        const filterQuery = userLocation?.pincode ? `pincode:=${userLocation.pincode}` : "";

        const response = await axios.get(
          `${TYPESENSE_API_URL}/collections/${collectionName}/documents/search`,
          {
            params: {
              q: searchTerm,
              query_by: "title,tags,username,pincode",
              filter_by: filterQuery,
              per_page: 30,
            },
            headers: {
              "X-TYPESENSE-API-KEY": TYPESENSE_API_KEY,
            },
          }
        );

        onResults(response.data.hits || []);
      } catch (err) {
        setError("Failed to perform search. Try again.");
        onResults([]);
      } finally {
        setLoading(false);
      }
    }, 400)
  ).current;

  const search = useCallback(
    (searchTerm) => {
      debouncedSearch(searchTerm, activePage, userLocation, onResults, setLoading, setError);
    },
    [activePage, userLocation, onResults, debouncedSearch]
  );

  useEffect(() => {
    search(query);
    return () => {
      debouncedSearch.cancel();
    };
  }, [query, search, debouncedSearch]);

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <input
        type="search"
        className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
        placeholder={`Search ${activePage}...`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={`Search ${activePage}`}
      />
      {loading && <div className="absolute right-3 top-3 animate-spin">⌛</div>}
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}
