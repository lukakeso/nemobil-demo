import "./App.css";
import dayjs from 'dayjs'
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import { useEffect, useState, useRef} from "react";
import { delay, getLocationCoordinates, getToken, makeTripRequest, retrieveTripProposal, confirmTrip, getTrip, getVehicle, MapView} from "./utils";

export default function App() {

  const [firstFit, setFirstFit] = useState(true);
  const [msVehicleFetchInterval, setMsVehicleFetchInterval] = useState(5000);
  const [msTimeout, setMsTimeout] = useState(6000);

  const [errorMessage, setErrorMessage] = useState(null);

  const [activeTab, setActiveTab] = useState("demo");
  const [startAddress, setStartAddress] = useState("Paderborn, Marienplatz");
  const [targetAddress, setTargetAddress] = useState("Paderborn, HBF"); 

  // const [confirmedStartAddress, setConfirmedStartAddress] = useState("");
  // const [confirmedTargetAddress, setConfirmedTargetAddress] = useState(""); 
  // const [confirmedPickupDateTime, setConfirmedPickupDateTime] = useState(null);

  // const [startCoordinates, setStartCoordinates] = useState(["", ""]);
  // const [targetCoordinates, setTargetCoordinates] = useState(["", ""]);

  // const [selectedStartAddress, setSelectedStartAddress] = useState("");
  // const [selectedTargetAddress, setSelectedTargetAddress] = useState(""); 

  const [selectedPickupDateTime, setSelectedPickupDateTime] = useState("");
  const [pickupDateTime, setPickupDateTime] = useState(new Date());


  const [isLoading, setIsLoading] = useState(false);

  const [retrievedProposalData, setRetrievedProposalData] = useState(null);
  const [retrievedTripData, setRetrievedTripData] = useState(null);
  const [vehicleData, setVehicleData] = useState(null);
  const [vehicleID, setVehicleID] = useState(null);

  const [showPopup, setShowPopup] = useState(false);
  const [clickedIndex, setClickedIndex] = useState(null);
  const [shuffledCarImages, setShuffledCarImages] = useState([
    { type: 'dgrey', url: '/all_cabs/inyo-darkgrey-small.png'},
    { type: 'lgrey', url: '/all_cabs/inyo-lightgrey-small.png' },
    { type: 'red', url: '/all_cabs/inyo-red-small.png' },
  ]);

  const mapRef = useRef(null);
  const tableRef = useRef(null);

  useEffect(() => {
    if (retrievedTripData?.pickupLocation?.value?.coordinates && mapRef.current) {
      mapRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [JSON.stringify(retrievedTripData?.pickupLocation?.value?.coordinates)]);

  useEffect(() => {
    if (retrievedProposalData && tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [retrievedProposalData]);

  useEffect(() => {
    if (!retrievedTripData) return;
  
    const start = retrievedTripData.pickupLocation?.value?.coordinates;
    const end = retrievedTripData.dropoffLocation?.value?.coordinates;
    const initial = vehicleData?.location?.value?.coordinates ?? start; // fallback
  
    const intervalId = simulateVehicleAbsoluteStep(initial, start, end, setVehicleData);
  
    return () => clearInterval(intervalId); // cleanup
  }, [retrievedTripData]);

  function timeoutPromise(ms) {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    );
  }

  function simulateVehicleAbsoluteStep(initialPos, start, end, setVehicleData) {
    const stepSize = 0.0002; // about ~11m at equator
    let current = [...initialPos];
    let target = [...start];
    let phase = 'toStart';
  
    const stepToward = (from, to) => {
      const newPos = [...from];
  
      for (let i = 0; i < 2; i++) {
        const diff = to[i] - from[i];
        if (Math.abs(diff) <= stepSize) {
          newPos[i] = to[i]; // snap to target
        } else {
          newPos[i] += stepSize * Math.sign(diff); // move toward
        }
      }
  
      return newPos;
    };
  
    const coordsEqual = (a, b) => (
      Math.abs(a[0] - b[0]) < 1e-5 && Math.abs(a[1] - b[1]) < 1e-5
    );
  
    const intervalId = setInterval(() => {
      current = stepToward(current, target);
      setVehicleData(prev => ({
        ...prev,
        location: {
          type: 'GeoProperty',
          value: {
            type: 'Point',
            coordinates: current
          }
        }
      }));
      //console.log(vehicleData);
  
      // When target reached, switch
      if (coordsEqual(current, target)) {
        if (phase === 'toStart') {
          phase = 'startToEnd';
          target = [...end];
        } else if (phase === 'startToEnd') {
          phase = 'endToStart';
          target = [...start];
        } else {
          phase = 'startToEnd';
          target = [...end];
        }
      }
    }, 1000); // every 200ms
  
    return intervalId;
  }
  
  

  function TripProposalTable({ proposals }) {

    const topThreeProposals = proposals.slice(0, 3);

    const handleRowClick = (index) => {
      setClickedIndex(index);
      setShowPopup(true);
    };

    const handleConfirm = async () => {
      const token = await Promise.race([
        getToken(),
        timeoutPromise(msTimeout),
      ]);
      const tripId = topThreeProposals[clickedIndex].request.object.split(':').pop();
      //console.log(clickedIndex);
      //console.log(topThreeProposals[clickedIndex])
      try {
        const tripConfirmed = await Promise.race([
          confirmTrip(topThreeProposals[clickedIndex], tripId, token),
          timeoutPromise(msTimeout),
        ]);
        //console.log("trip confirmed", tripConfirmed);
        if (tripConfirmed.status === 409){
          setErrorMessage("Trip confirmation failed,\nPlease request a new trip.");
          throw new Error("Trip already exists");
        } else if (tripConfirmed !== null) {
          let tripData = await Promise.race([
            getTrip(tripId, token),
            timeoutPromise(msTimeout),
          ]);
          const parsedTripData = typeof tripData === "string" ? JSON.parse(tripData) : tripData;
          const vehicleId = parsedTripData.vehicle?.value;

          const vehicleData = await Promise.race([
            getVehicle(vehicleId, token),
            timeoutPromise(msTimeout),
          ]);
          const parsedVehicleData = typeof vehicleData === "string" ? JSON.parse(vehicleData) : vehicleData;
          // //console.log("vehicle", parsedVehicleData);
          //console.log("parsed Trip Data", parsedTripData);

          //console.log("trip ID: ", tripId)
          //console.log("vehicle id: ", vehicleId)
          setRetrievedProposalData(null);
          setShowPopup(false);
          setVehicleID(vehicleId);
          setRetrievedTripData(parsedTripData);
          setVehicleData(parsedVehicleData);
          

        }
      } catch (error) {
        console.error("Trip confirmation failed:", error);
        setErrorMessage("Trip confirmation failed,\nPlease try again.");

      }
    };

    const handleCancel = () => {
      setShowPopup(false);
    };

    return (
      <div className="table-text-container">
        <h2 className="text-xl font-bold mb-2">Trip Proposals</h2>
          <div className="centered-table-container">
            <table className="centered-table" style={{ backgroundColor: 'white' }}>
              <thead>
                <tr className="bg-gray-200">
                  <th className="p-2">#</th>
                  <th className="p-2">Pickup Time</th>
                  <th className="p-2">Expected Dropoff Time</th>
                  <th className="p-2">Car Type</th>
                </tr>
              </thead>
              <tbody>
                {topThreeProposals.map((proposal, index) => (
                  <tr
                    key={index}
                    onClick={() => handleRowClick(index)}
                    className={index === clickedIndex ? "selected" : ""}
                  >
                    <td className="p-2">{index + 1}</td>
                    
                    <td className="p-2">{dayjs(proposal.pickupTime?.value).format('MMMM D, HH:mm')}</td>
                    <td className="p-2">{dayjs(proposal.proposalReleaseTime?.value).format('MMMM D, HH:mm')}</td>
                    <td className="p-2">
                      {shuffledCarImages[index] && (
                        <img
                          src={shuffledCarImages[index].url}
                          alt={shuffledCarImages[index].type}
                          style={{ width: 'auto', height: '150px', objectFit: 'cover', borderRadius: '4px'}}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        

        {showPopup && (
          <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-40 flex items-center justify-center">
            <div className="bg-white p-6 rounded shadow-md">
              <p className="text-lg font-semibold"><strong>Confirm trip #{clickedIndex+1}?</strong></p>
              <div>
                <button
                  onClick={handleCancel}
                  className="confirm-button"
                >
                  No
                </button>
                <button
                  onClick={handleConfirm}
                  className="confirm-button"
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  async function handleStartTrip(startAddress, targetAddress, pickupDateTime) {
    const shuffleArray = (array) => {
      const copy = [...array];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };
    setClickedIndex(null);
    setShowPopup(false);
    setFirstFit(true);
    setErrorMessage(null);
    setRetrievedProposalData(null);
    setRetrievedTripData(null);
    setVehicleData(null);
    setVehicleID(null);
    setIsLoading(true); 
    //setSelectedStartAddress(startAddress);
    //setSelectedTargetAddress(targetAddress);
    setSelectedPickupDateTime(pickupDateTime.toISOString());
    try {
      const startCoordinates = await Promise.race([
        getLocationCoordinates(startAddress, "start"),
        timeoutPromise(msTimeout),
      ]);

      const targetCoordinates = await Promise.race([
        getLocationCoordinates(targetAddress, "target"),
        timeoutPromise(msTimeout),
      ]);
      
      //setStartCoordinates(startCoordinates);
      //setTargetCoordinates(targetCoordinates);

      if (!startCoordinates.every(coord => coord === null) && !targetCoordinates.every(coord => coord === null)) {

        // call context broker if coordinates are not null
        const token = await Promise.race([
          getToken(),
          timeoutPromise(msTimeout),
        ]);

        const tripId = await Promise.race([
          makeTripRequest(startCoordinates, targetCoordinates, selectedPickupDateTime, token),
          timeoutPromise(msTimeout),
        ]);
        
        const retrievedProposalData = await Promise.race([
          retrieveTripProposal(tripId, token),
          timeoutPromise(msTimeout),
        ]);
        if (retrievedProposalData === "[]"){
          throw new Error(`Could not find any trips in your area.`);
        }
        
        const parsedProposalsData = typeof retrievedProposalData === "string" ? JSON.parse(retrievedProposalData) : retrievedProposalData;
        setRetrievedProposalData(parsedProposalsData);

        const shuffled = shuffleArray(shuffledCarImages).slice(0, 3);
        setShuffledCarImages(shuffled);
      }

    } catch (error) {
      console.error("Trip setup failed:", error.message);
      setErrorMessage("Trip setup failed,\nPlease try again.");

    } finally {
      setIsLoading(false); // Hide loading indicator
    }
  }


  const renderContent = () => {
    switch (activeTab) {
      case "demo":
        return (
          <div className="p-4 space-y-4">
            <p>Welcome to Demo Page!</p>
            <div style={{ maxWidth: "500px", margin: "0 auto", textAlign: "center" }}>
              <div style={{ marginBottom: "1.5rem" }}>
                <label className="form-row">
                  <span className="form-label"><strong>Start Address: </strong></span>
                  <input
                    type="text"
                    value={startAddress}
                    onChange={(e) => setStartAddress(e.target.value)}
                    className="form-input"
                    placeholder="Enter Start Address"
                  />
                </label>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label className="form-row">
                  <span className="form-label"><strong>Target Address: </strong></span>
                  <input
                    type="text"
                    value={targetAddress}
                    onChange={(e) => setTargetAddress(String(e.target.value))}
                    className="form-input"
                    placeholder="Enter Target Address"
                  />
                </label>
              </div>

              <div>
                <label className="form-row">
                  <span className="form-label"><strong>Pickup Time: </strong></span>
                  <DatePicker
                    selected={pickupDateTime}
                    onChange={(date) => {
                      const prev = pickupDateTime || new Date();
                    
                      // Check if the date part changed (ignoring time)
                      const isDateChanged = date.toDateString() !== prev.toDateString();

                      const updated = new Date(prev); // start with previous value
                    
                      if (isDateChanged) {
                        // User changed the date → update date, preserve time
                        updated.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                      } else {
                        // User changed time → update time, preserve date
                        updated.setHours(date.getHours(), date.getMinutes(), 0, 0);
                      }
                      setPickupDateTime(updated);
                    }}
                    showTimeSelect
                    minDate={new Date()} // no past dates
                    minTime={
                      pickupDateTime &&
                      pickupDateTime.toDateString() === new Date().toDateString()
                        // current time (and reset seconds so we can select 20:15 if it is 20:15)
                        ? new Date(new Date().setSeconds(0, 0)) 
                        : new Date(new Date().setHours(0, 0, 0, 0)) // start of day otherwise
                    }
                    maxTime={new Date(new Date().setHours(23, 59))} // latest time of day
                    timeFormat="HH:mm"
                    dateFormat="dd.MMMM.yyyy HH:mm"  // or "Pp" for locale-based
                    timeIntervals={15}             // optional: step in minutes
                    className="form-input"
                    dayClassName={date =>
                      date < new Date() ? "disabled-day" : undefined
                    }
                  />
                  <button
                    type="button"
                    className="time-button"
                    onClick={() => setPickupDateTime(new Date())}
                    style={{ marginLeft: '8px' }}
                  >
                    Now
                  </button>
                </label>
              </div>

              <p></p>
              <div>
                <button
                  type="button"
                  onClick={() => handleStartTrip(startAddress, targetAddress, pickupDateTime)}
                  className="mt-6 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Find Available Trips
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center h-32">
                <div className="spinner p-32" style={{ width: "48px", height: "48px", borderWidth: "8px" }}></div>
              </div>
            ) : (
              <>
                {errorMessage !== null ? (
                  <div><strong>{errorMessage}</strong></div>
                ) : null}

                {retrievedProposalData !== null && (
                  <div ref={tableRef}>
                    <TripProposalTable proposals={retrievedProposalData} />
                  </div>
                )}

                {retrievedTripData !== null ? (
                  <div>
                    <h2>Confirmed Trip:</h2>
                    <p className="confirm-box" style={{
                      display: 'flex',
                      alignItems: 'center',  // vertical center alignment
                      gap: '75px'
                    }}>
                    <div style={{ flexGrow: 1, textAlign: 'right' }}>
                      Pickup Time: <strong>{dayjs(retrievedTripData.pickupTime?.value).format('MMMM D, HH:mm')}</strong>
                    </div>
                    <img
                      src={shuffledCarImages[clickedIndex].url}
                      alt={shuffledCarImages[clickedIndex].type}
                      style={{ width: 'auto', height: '150px', objectFit: 'cover', borderRadius: '4px', marginLeft: 'auto', marginRight: '25px'}}
                    />
                    <br />
                    </p>
                    <div className="map-container" ref={mapRef}>
                      <MapView
                        start={retrievedTripData.pickupLocation?.value?.coordinates}      // Berlin
                        end={retrievedTripData.dropoffLocation?.value?.coordinates}         // Nearby
                        //taxi={[52.521, 13.397]}      // Somewhere in between
                        taxi={vehicleData.location?.value?.coordinates}
                        firstFit={firstFit}
                        setFirstFit={setFirstFit}   // pass setter down
                      />
                    </div>
                  </div>
                ) : null}

                
              </>
            )}

          </div>
        );
      case "about":
        return (
          <div className="p-4 space-y-4">
            <p>Visit the project site:{" "}<a
              href="https://nemo-bil.de/"
              className="text-blue-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              nemo-bil.de
            </a></p>

            <img 
              src="./BMWK-EU_Nemobil.png" 
              alt="BMWK Logo" 
              className="bottom-logo" 
            />
          </div>  
        );
      default:
        return <div className="p-4">Page not found.</div>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Top image */}
      <div className="pt-5 pb-5">
        <img 
          src="./NeMo.bil-Logo.svg" 
          alt="NeMo.bil Logo" 
          className="top-logo" 
        />
      </div>
      
      <header className="bg-blue-600 text-white pt-5 pb-5 shadow">
        {/* <h1 className="text-2xl font-bold">NeMo.bil demo</h1>*/}
        <nav className="mt-2 space-x-4">
          <button onClick={() => setActiveTab("demo")} className="hover:underline">
            DEMO
          </button>
          <button onClick={() => setActiveTab("about")} className="hover:underline">
            ABOUT
          </button>
        </nav>
      </header>

      <main className="p-4">{renderContent()}</main>
    </div>
  );
}
