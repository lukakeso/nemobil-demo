import "./App.css";
import "leaflet/dist/leaflet.css";
import React, { useState, useEffect, useRef} from 'react';

//const API_URL = '';
//const API_URL = window._env_?.VITE_API_URL || process.env.VITE_API_URL || 'http://localhost:3001'; // url+port
//const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
//console.log(API_URL)
let API_URL;

if (typeof window !== 'undefined' && window._env_?.VITE_API_URL) {
  API_URL = window._env_.VITE_API_URL;
} else if (import.meta?.env?.BACKEND_PORT) {
  const BACKEND_PORT = import.meta.env.BACKEND_PORT;
  API_URL = `http://localhost:${BACKEND_PORT}`;
} else {
  API_URL = 'http://localhost:3001';
}


function getRandomInt() {
  return Math.floor(Math.random() * 10000) + 1;
}

export async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getLocationCoordinates(address, label, token) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=jsonv2&limit=1`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "NeMo.bil-demo", // polite to add your app info
      },
    });

    if (!response.ok) {
      throw new Error(`Error fetching location: ${response.statusText}`);
    }

    const data = await response.json();

    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      return [lat, lon];
    } else {
      throw new Error("No results found");
    }
  } catch (error) {
    console.error(`${label} lookup failed:`, error);
    return [null, null];
  }
}


export async function getToken() {
  try {
    const response = await fetch(`${API_URL}/app/get_token`, {});

    // Check response status
    if (response.status !== 200) {
      throw new Error(`Token request failed with status ${response.status}`);
    }
    const data = await response.json();

    // Ensure token exists
    if (!data.access_token) {
      throw new Error("No access token found in response");
    }

    return data.access_token;

  } catch (error) {
    console.error("Error getting token:", error);
    return null;
  }
}


export async function makeTripRequest(startCoordinates, targetCoordinates, selectedPickupDateTime, token) {
  let trip_id = getRandomInt(10000);
  let attempt = 1;
  const maxRetries = 5;
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const myHeaders = new Headers();
  myHeaders.append("Link", "<https://api.npoint.io/d66beea7313de1ad894c>; rel=\"http://www.w3.org/ns/json-ld#context\"; type=\"application/ld+json\"");
  myHeaders.append("fiware-service", "default_dataspace");
  myHeaders.append("Content-Type", "application/json");
  myHeaders.append("Authorization", "Bearer "+token);
  
  const raw = JSON.stringify({
    "startLocation": {
      "value": {
        "type": "Point",
        "coordinates": startCoordinates
      },
      "type": "GeoProperty"
    },
    "targetLocation": {
      "value": {
        "type": "Point",
        "coordinates": targetCoordinates
      },
      "type": "GeoProperty"
    },
    "pickupTime": {
      "type": "Property",
      "value": selectedPickupDateTime
    },
    "user": {
      "type": "Property",
      "value": "urn:ngsi-ld:User:user1"
    },
    "requestedAdults": {
      "type": "Property",
      "value": 1
    },
    "requestedChilds": {
      "type": "Property",
      "value": 0
    },
    "luggage": {
      "type": "Property",
      "value": 0
    },
    "skills": {
      "type": "Property",
      "value": [
        {
          "id": "urn:ngsi-ld:Skill:WheelChair",
          "name": "WheelChair"
        }
      ]
    },
    "personalPreferences": {
      "type": "Property",
      "value": {
        "allowCarpooling": {
          "type": "Property",
          "value": false
        },
        "toleratedDelayBefore": {
          "type": "Property",
          "value": 1
        },
        "toleratedDelayAfter": {
          "type": "Property",
          "value": 1
        }
      }
    },
    "id": "urn:ngsi-ld:TripRequest:"+trip_id,
    "type": "TripRequest"
  });
  
  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow"
  };
  
  // Function to update trip_id in requestOptions.body
  function updateTripIdInRequestOptions() {
    trip_id += 1;
    const bodyObject = JSON.parse(requestOptions.body);
    bodyObject.id = "urn:ngsi-ld:TripRequest:" + trip_id;
    requestOptions.body = JSON.stringify(bodyObject);
  }

  while (attempt <= maxRetries) {
    const response = await fetch(`${API_URL}/app/post_trip`, requestOptions);
    //console.log(`Attempt ${attempt}:`, 'ID:', trip_id, "status:", response.status);

    if (response.status === 409) {
      console.warn(`Trip ID conflict, retrying... (Attempt ${attempt})`);
      trip_id += 1;
      updateTripIdInRequestOptions();
      await delay(500);
      attempt++;
      continue;
    } else if (response.status === 201) {
      //console.log(`Trip request succeeded with trip_id ${trip_id}`);
      return trip_id;
    }
  }
  throw new Error("Max retries reached");
}


export async function retrieveTripProposal(trip_id, token) {

  const myHeaders = new Headers();
  myHeaders.append("Link", "<https://api.npoint.io/d66beea7313de1ad894c>; rel=\"http://www.w3.org/ns/json-ld#context\"; type=\"application/ld+json\"");
  myHeaders.append("fiware-service", "default_dataspace");
  myHeaders.append("Authorization", "Bearer "+token);

  const requestOptions = {
    method: "GET",
    headers: myHeaders,
    redirect: "follow"
  };

  try {
    const response = await fetch(`${API_URL}/app/get_trip_proposal/${trip_id}`, requestOptions)
  
    // Check response status
    if (response.status !== 200) {
      throw new Error(`Trip proposal request failed with status ${response.status}`);
    }
    const data = await response.text();
    return data;

  } catch (error) {
    console.error("Error getting trip:", error);
    return null;
  }
}

export async function confirmTrip(selectedProposal, trip_id, token) {

  const pickupTime = selectedProposal.pickupTime;//?.value;
  const pickupLocation = selectedProposal.pickupLocation;//?.value?.coordinates;
  const dropoffTime = selectedProposal.targetTime;//?.value;
  const dropoffLocation = selectedProposal.dropoffLocation;//?.value?.coordinates;

  const myHeaders = new Headers();
  myHeaders.append("Link", "<https://api.npoint.io/d66beea7313de1ad894c>; rel=\"http://www.w3.org/ns/json-ld#context\"; type=\"application/ld+json\"");
  myHeaders.append("fiware-service", "default_dataspace");
  myHeaders.append("Content-Type", "application/json");
  myHeaders.append("Authorization", "Bearer "+token);

  const raw = JSON.stringify({
    "pickupTime": pickupTime,
    "pickupLocation": pickupLocation,
    "id": "urn:ngsi-ld:Trip:"+trip_id,
    "type": "Trip",
    "dropoffLocation": dropoffLocation,
    "personalPreferences": {
      "type": "Property",
      "value": {
        "allowCarpooling": {
          "type": "Property",
          "value": false
        },
        "toleratedDelayBefore": {
          "type": "Property",
          "value": 1
        },
        "toleratedDelayAfter": {
          "type": "Property",
          "value": 1
        }
      }
    },
    "skills": {
      "type": "Property",
      "value": [
        {
          "id": "urn:ngsi-ld:Skill:WheelChair",
          "name": "WheelChair"
        }
      ]
    },
    "requestedAdults": {
      "type": "Property",
      "value": 1
    },
    "requestedChilds": {
      "type": "Property",
      "value": 0
    },
    "luggage": {
      "type": "Property",
      "value": 0
    },
    "user": {
      "type": "Property",
      "value": "urn:ngsi-ld:User:user1"
    },
    "status": {
      "type": "Property",
      "value": [
        "Unplanned"
      ]
    }
  });

  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow"
  };

  try {
    const response = await fetch(`${API_URL}/app/confirm_trip`, requestOptions)
    // Check response status
    if (response.status !== 201) {
      throw new Error(`Trip creation failed with status ${response.status}`);
    }
    return response
  } catch (error) {
    console.error("Error requesting trip:", error);
    return null
  }
}


export async function getTrip(trip_id, token) {
  let attempt = 1;
  const maxRetries = 5;
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const myHeaders = new Headers();
  myHeaders.append("Link", "<https://api.npoint.io/d66beea7313de1ad894c>; rel=\"http://www.w3.org/ns/json-ld#context\"; type=\"application/ld+json\"");
  myHeaders.append("fiware-service", "default_dataspace");
  myHeaders.append("Authorization", "Bearer "+token);

  const requestOptions = {
    method: "GET",
    headers: myHeaders,
    redirect: "follow"
  };

  // try {
  //   const response = await fetch(`${API_URL}/app/get_trip/${trip_id}`, requestOptions)

  //   // Check response status
  //   if (response.status !== 200) {
  //     throw new Error(`Trip retrieve request failed with status ${response.status}`);
  //   }

  //   const data = await response.text();
  //   const parsedData = typeof data === "string" ? JSON.parse(data) : data;
  //   parsedData.vehicle?.value;
  //   return data;

  // } catch (error) {
  //   console.error("Error getting trip:", error);
  //   return null;
  // }

  while (attempt <= maxRetries) {
    const response = await fetch(`${API_URL}/app/get_trip/${trip_id}`, requestOptions);
    const data = await response.text();
    const parsedData = typeof data === "string" ? JSON.parse(data) : data;

    //console.log("parsed Data: ", parsedData.vehicle?.value)

    if (parsedData.vehicle?.value !== undefined) {
      //console.warn(`Trip ID conflict, retrying... (Attempt ${attempt})`);
      return data;
    } else {
      //console.log(`Trip request succeeded with trip_id ${trip_id}`);
      attempt++;
      await delay(500);
    }
  }
  throw new Error("Max retries reached");
}

export async function getVehicle(vehicle_id, token) {

  const myHeaders = new Headers();
  myHeaders.append("Link", "<https://api.npoint.io/d66beea7313de1ad894c>; rel=\"http://www.w3.org/ns/json-ld#context\"; type=\"application/ld+json\"");
  myHeaders.append("fiware-service", "default_dataspace");
  myHeaders.append("Authorization", "Bearer "+token);
  
  const requestOptions = {
    method: "GET",
    headers: myHeaders,
    redirect: "follow"
  };  

  try {
    const response = await fetch(`${API_URL}/app/get_vehicle/${vehicle_id}`, requestOptions)

    // Check response status
    if (response.status !== 200) {
      throw new Error(`Trip retrieve request failed with status ${response.status}`);
    }

    const data = await response.text();
    return data;

  } catch (error) {
    console.error("Error getting trip:", error);
    return null;
  }
}


import { MapContainer, TileLayer, Marker, Popup, useMap} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Import your custom icons
import startIconUrl from "../public/location_pin.png";
import endIconUrl from "../public/flag_filled.png";
import taxiIconUrl from "../public/inyo_cab.png";

// Define custom icons
const startIcon = new L.Icon({
  iconUrl: startIconUrl,
  iconSize: [32, 32],
  iconAnchor: [16, 30],
});

const endIcon = new L.Icon({
  iconUrl: endIconUrl,
  iconSize: [32, 32],
  iconAnchor: [4, 27],
});

const taxiIcon = new L.Icon({
  iconUrl: taxiIconUrl,
  iconSize: [40, 40],
  iconAnchor: [20, 32],
});

export function MapView({ start, end, taxi, firstFit, setFirstFit}) {
  
  // Utility component to adjust the map bounds
  function FitBounds({ points }) {
    const map = useMap();

    useEffect(() => {
      const validPoints = points.filter(Boolean); // remove null/undefined
      if (validPoints.length === 0) return;

      const bounds = L.latLngBounds(validPoints);
      map.fitBounds(bounds, { padding: [25, 25] });
      setFirstFit(false);
    }, [points, map]);

    return null;
  }

  function getMidpoint(start, end) {
    if (!start || !end) return null;
  
    const midLat = (start[0] + end[0]) / 2;
    const midLon = (start[1] + end[1]) / 2;
  
    return [midLat, midLon];
  }

  const allPoints = [start, end, taxi];
  const fallbackCenter = getMidpoint(start, end) || [52.5211873, 13.3283758]; // fallback center
  return (
    <MapContainer center={fallbackCenter} zoom={13} style={{ height: "500px", width: "100%" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      {firstFit && (
        <FitBounds points={allPoints} />
      )}            

      {start && (
        <Marker position={start} icon={startIcon}>
          <Popup>Start Location</Popup>
        </Marker>
      )}
      {end && (
        <Marker position={end} icon={endIcon}>
          <Popup>Dropoff Location</Popup>
        </Marker>
      )}
      {taxi && (
        <Marker position={taxi} icon={taxiIcon}>
          <Popup>Taxi Location</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}