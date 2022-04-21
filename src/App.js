import React, { useEffect, useState, useRef } from "react";
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import Graphic from '@arcgis/core/Graphic';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import axios from 'axios';
import searchIcon from './assets/search.png';
import './App.css'


function App() {
  const url = 'https://services8.arcgis.com/qHjD7qvRpLDfQaeu/ArcGIS/rest/services/JordanMap/FeatureServer';
  const [map, setMap] = useState(null);
  const [view, setView] = useState(null);
  const [govs, setGovs] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [parks, setParks] = useState([]);
  const [allParks, setAllParks] = useState([]);
  const [selectedGov, setSelectedGov] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [codedValues, setCodedValues] = useState([]);
  const [search, setSearch] = useState(null);

  let mapView;
  let point;
  let popupTemplate;
  let markerSymbol;
  let graphic;
  let graphics = [];
  let graphicLayer;

  useEffect(() => {
    async function fetchData() {
      await axios.get(url + '/2' + '/query', {
        params: {
          where: "1=1", outFields: "*", f: "json"
        }
      })
        .then(res => {
          setGovs(res.data.features);
        })
        .catch(err => {
          console.log(err);
        });
    }
    fetchData();
    let newmap = new Map({
      basemap: 'hybrid'
    });
    setMap(newmap);
    mapView = new MapView({
      container: 'mapDiv',
      map: newmap,
      center: [36, 31.5],
      zoom: 8
    });
    setView(mapView);
  }, []);

  // to trigger the selected gov
  const onChangeGov = (e) => {
    setSelectedGov(e.target.value);
  };

  // to get districts based on selected gov
  useEffect(() => {
    let codedValue = [];
    async function fetchData() {

      // get the codedValue of the selected gov
      await axios.get(url + '/1', {
        params: {
          f: "json"
        }
      })
        .then(res => {
          codedValue = res.data.fields.find(field => field.name === 'DISTRICT_NAME_AR').domain.codedValues
          setCodedValues(codedValue);
        })
        .catch(err => {
          console.log(err);
        });

      // get the districts of the selected gov
      await axios.get(url + '/1' + '/query', {
        params: {
          where: `GOV_CODE =${selectedGov}`, outFields: "*", f: "json"
        }
      })
        .then(res => {
          // set the Arabic name to each istrict
          res.data.features.forEach(feature => {
            feature.attributes.DISTRICT_NAME_AR = codedValue?.find(codedValue => codedValue.code === feature.attributes.DISTRICT_NAME_AR).name;
          })
          setDistricts(res.data.features);
        })
        .catch(err => {
          console.log(err);
        });
    }
    if (selectedGov) {
      fetchData();
    }
  }, [selectedGov]);

  const onChangeDistrict = (e) => {
    setSelectedDistrict(e.target.value);
  }

  const searchParks = async () => {
    setParks([]);
    if (selectedDistrict) {
      await axios.get(url + '/0' + '/query', {
        params: {
          where: `DIST_CODE=${selectedDistrict}`, outFields: "*", f: "json"
        }
      })
        .then(res => {
          res.data.features.forEach(feature => {
            feature.attributes.DISTRICT_NAME_AR = codedValues?.find(codedValue => codedValue.code === feature.attributes.DIST_CODE).name;

            feature.attributes.GOV_NAME_AR = govs?.find(gov => gov.attributes.GOV_CODE === parseInt(selectedGov)).attributes.GOV_NAME_AR;
            // console.log("Find = ",govs?.find(gov => gov.attributes.GOV_CODE === parseInt(selectedGov)))
            // govs?.find(gov => {
            //   console.log("gov.attributes.GOV_CODE = ", gov.attributes.GOV_CODE , " = selectedGov = ", parseInt(selectedGov));
            // });
          })
          setAllParks(res.data.features);
          setParks(res.data.features);
        })
        .catch(err => {
          console.log(err);
        });
    }
  }

  // to add the marker to the map
  useEffect(() => {

    if (parks.length > 0) {
      map.removeAll();
      parks.map(park => {
        point = {
          type: "point", // autocasts as new Point()
          longitude: park.geometry.x,
          latitude: park.geometry.y
        };

        popupTemplate = {
          title: park.attributes.LANDMARK_ANAME,
          content: `<p> المحافظة :  ${park.attributes.GOV_NAME_AR}  </p>` +
            `<p>  المنطقة :  ${park.attributes.DISTRICT_NAME_AR}</p>`,

          actions: [{
            // This text is displayed as a tooltip
            title: "Zoom out",
            // The ID by which to reference the action in the event handler
            id: "zoom-out",
            // Sets the icon font used to style the action button
            className: "esri-icon-zoom-out-magnifying-glass"
          }]

        };

        markerSymbol = {
          type: "simple-marker", // autocasts as new SimpleMarkerSymbol()
          style: "square",
          color: "blue",
          width: 7,
          outline: {
            color: [255, 255, 255],
            width: 2
          }
        };

        graphic = new Graphic({
          geometry: point,
          symbol: markerSymbol,
          popupTemplate: popupTemplate
        });

        graphics.push(graphic);
      })


      // add the graphics to the map
      graphicLayer = new GraphicsLayer({
        graphics: graphics
      });

      map?.add(graphicLayer);
      view?.goTo({
        center: [parks[0].geometry.x, parks[0].geometry.y],
        zoom: 12
      });
    }

  }, [parks]);

  const zoomIn = (park) => {
    view.goTo({
      center: [park.geometry.x, park.geometry.y],
      zoom: 18
    });
  }



  const searchPark = (e) => {
    // setParks(allParks);
    let park = allParks.filter(park => park.attributes.LANDMARK_ANAME.includes(e.target.value));
    setParks(park);
    setSearch(e.target.value);
  }

  const handleSearchPark = async (park) => {
  }

  function zoomOut() {
    // In this case the view zooms out two LODs on each click
    view.goTo({
      center: view.center,
      zoom: view.zoom - 2
    });
  }

  // This event fires for each click on any action
  // Notice this event is handled on the default popup of the View
  // NOT on an instance of PopupTemplate
  view?.popup.on("trigger-action", function (event) {
    // If the zoom-out action is clicked, fire the zoomOut() function
    if (event.action.id === "zoom-out") {
      zoomOut();
    }
  });

  return (
    <div className="App">
      <div className="w-full flex ">
        <div id='mapDiv' className="w-3/4 mb-4"></div>
        <div className="search-div flex  flex-col items-center w-1/4">
          <h3 className="my-3">البحث عن المعالم</h3>
          <select className="select-css my-3" onChange={onChangeGov}>
            <option value="">اختر المحافظة</option>
            {govs?.map((gov, idx) => {
              return <option key={idx} value={gov.attributes.GOV_CODE}>{gov.attributes.GOV_NAME_AR}</option>
            })}
          </select>

          <select className="select-css" onChange={onChangeDistrict}>
            <option value="">اختر المنطقه</option>
            {districts?.map((district, idx) => {
              return <option key={idx} value={district.attributes.DIST_CODE}>{district.attributes.DISTRICT_NAME_AR}</option>
            })}
          </select>

          <button className="my-3 p-3 btn-css bg-blue-600" onClick={searchParks}>بحث</button>

        </div>
      </div>

      <div className=" w-full flex flex-col ">
        <div className=" w-3/4 flex flex-row justify-end">
          <div className="flex flex-row border mr-4 ">
            <input onChange={searchPark} type="text" className="form-control" placeholder="Search" aria-label="Search" />
            <img onClick={handleSearchPark} src={searchIcon} alt="search" className="w-5 h-5 bg-white" />
          </div>

          <span>إسم المعلم </span>
        </div>

        <div className="w-full">
          <table className="w-3/4 divide-y divide-gray-200 table-fixed dark:divide-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th scope="col" className="text-center py-3 px-6 text-s font-bold tracking-wider  text-gray-700 uppercase dark:text-gray-400">المنطقة</th>
                <th scope="col" className="text-center py-3 px-6 text-s font-bold tracking-wider  text-gray-700 uppercase dark:text-gray-400">المحافظة</th>
                <th scope="col" className="text-center py-3 px-6 text-s font-bold tracking-wider  text-gray-700 uppercase dark:text-gray-400" >المعلم</th>
              </tr>
            </thead>
            <tbody>
              {parks?.map((park, idx) => {
                return <tr key={idx} onClick={() => zoomIn(park)} className="hover:cursor-pointer hover:bg-gray-200">
                  <td className="py-3 px-6 text-s font-bold tracking-wider text-center text-gray-700 uppercase dark:text-gray-400">{park.attributes.DISTRICT_NAME_AR}</td>
                  <td className="py-3 px-6 text-s font-bold tracking-wider text-center text-gray-700 uppercase dark:text-gray-400">{park.attributes.GOV_NAME_AR}</td>
                  <td className="py-3 px-6 text-s font-bold tracking-wider text-center text-gray-700 uppercase dark:text-gray-400">{park.attributes.LANDMARK_ANAME}</td>

                </tr>
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

export default App;
