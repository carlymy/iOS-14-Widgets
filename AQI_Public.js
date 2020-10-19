/* AIR QUALITY INFO */ 

// AQI Sources
//  (1) Go to https://fire.airnow.gov/ and navigate to your location
//  (2) Click on a sensor near you (the small squares)
//  (3) Copy the ID for the sensor (the 5 numbers at the end of the "Site ID")
//  (4) Paste into the quotations in Line 10 of the script

const API_URL = "https://www.purpleair.com/json?show=";
const SENSOR_ID = args.widgetParameter || "PASTE_ID_HERE";
 
// Get Sensor Data

async function getSensorData(url, id) {
  const req = new Request(`${url}${id}`);
  const json = await req.loadJSON();

  return {
    val: json.results[0].Stats,
    adj1: json.results[0].pm2_5_cf_1,
    adj2: json.results[1].pm2_5_cf_1,
    ts: json.results[0].LastSeen,
    hum: json.results[0].humidity,
    loc: json.results[0].Label,
    lat: json.results[0].Lat,
    lon: json.results[0].Lon,
  };
}

// Get EPA Adjusted PPM

function computePM(sensorData) {
  const adj1 = Number.parseInt(sensorData.adj1, 10);
  const adj2 = Number.parseInt(sensorData.adj2, 10);
  const hum = Number.parseInt(sensorData.hum, 10);
  const dataAverage = (adj1 + adj2) / 2;

  return 0.52 * dataAverage - 0.085 * hum + 5.71;
}

// Get AQI Number from PPM Reading

function aqiFromPM(pm) {
  if (pm > 350.5) return calculateAQI(pm, 500.0, 401.0, 500.0, 350.5);
  if (pm > 250.5) return calculateAQI(pm, 400.0, 301.0, 350.4, 250.5);
  if (pm > 150.5) return calculateAQI(pm, 300.0, 201.0, 250.4, 150.5);
  if (pm > 55.5) return calculateAQI(pm, 200.0, 151.0, 150.4, 55.5);
  if (pm > 35.5) return calculateAQI(pm, 150.0, 101.0, 55.4, 35.5);
  if (pm > 12.1) return calculateAQI(pm, 100.0, 51.0, 35.4, 12.1);
  if (pm >= 0.0) return calculateAQI(pm, 50.0, 0.0, 12.0, 0.0);
  return "-";
}

// Calculate AQI

function calculateAQI(Cp, Ih, Il, BPh, BPl) {
  const a = Ih - Il;
  const b = BPh - BPl;
  const c = Cp - BPl;
  return Math.round((a / b) * c + Il);
}

// AQI Level Thresholds

const LEVEL_ATTRIBUTES = [
  {
    threshold: 300,
    label: "Hazardous",
  },
  {
    threshold: 200,
    label: "Very Unhealthy",
  },
  {
    threshold: 150,
    label: "Unhealthy",
  },
  {
    threshold: 100,
    label: "Unhealthy for Sensitive Groups",
  },
  {
    threshold: 50,
    label: "Moderate",
  },
  {
    threshold: -20,
    label: "Good",
  },
];

// Calculate AQI Level

function calculateLevel(aqi) {
  const level = Number(aqi) || 0;

  const {
    label = "Weird",
    threshold = -Infinity,
  } = LEVEL_ATTRIBUTES.find(({ threshold }) => level > threshold) || {};

  return {
    label,
    threshold,
    level,
  };
}

// Calculate AQI Trend

function getAQITrend({ v1: partLive, v3: partTime }) {
  const partDelta = partTime - partLive;
  if (partDelta > 5) return "arrow.down";
  if (partDelta < -5) return "arrow.up";
  return "arrow.left.and.right";
}

/* BACKGROUND IMAGE */

// Build Cache

const files = FileManager.local()
const currentDate = new Date()

const cachePath = files.joinPath(files.documentsDirectory(), "weather-cal-cache")
const cacheExists = files.fileExists(cachePath)
const cacheDate = cacheExists ? files.modificationDate(cachePath) : 0
var data

if (cacheExists && (currentDate.getTime() - cacheDate.getTime()) < 60000) {
  const cache = files.readString(cachePath)
  data = JSON.parse(cache)
}

function sameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

// Image Selection
// (1) Go to https://source.unsplash.com
// (2) Select collection
// (3) Copy & paste collection number (it's in the URL) into Line 146 below

let collection = "PASTE_COLLECTION_NUMBER_HERE"
let widgetInputRAW = args.widgetParameter
if (widgetInputRAW) {
  try {
    widgetInputRAW.toString()
    if (widgetInputRAW.toString() !== "") {
      collection = widgetInputRAW.toString()
    }
  } catch (e) {
    throw new Error("Please long press the widget and add a parameter.")
  }
}

/* BUILD WIDGET */

// Widget Formatting
// *Enter the location of your sensor on Line 211*

async function run() {
  const widget = new ListWidget();
  widget.setPadding(10, 15, 10, 10);

  try {
    console.log(`Using sensor ID: ${SENSOR_ID}`);

    const data = await getSensorData(API_URL, SENSOR_ID);
    const stats = JSON.parse(data.val);
    console.log(stats);

    const aqiTrend = getAQITrend(stats);
    console.log(aqiTrend);

    const epaPM = computePM(data);
    console.log(`EPA PM is ${epaPM}`);

    const aqi = aqiFromPM(epaPM);
    const level = calculateLevel(aqi);
    const aqiText = aqi.toString();
    console.log(`AQI is ${aqi}`);
    
    const textColor = new Color("ffffff");

    const header = widget.addText(`AQI`);
    header.textColor = textColor;
    header.font = Font.regularSystemFont(14);

    widget.addSpacer(5);

      const scoreStack = widget.addStack()
      const content = scoreStack.addText(aqiText);
      content.textColor = textColor;
      content.font = Font.mediumSystemFont(30);
      const trendSymbol = createSymbol(aqiTrend);
      const trendImg = scoreStack.addImage(trendSymbol.image);
      trendImg.resizable = false;
      trendImg.tintColor = textColor;
      trendImg.imageSize = new Size(30, 38);

    const wordLevel = widget.addText(level.label);
    wordLevel.textColor = textColor;
    wordLevel.font = Font.semiboldSystemFont(24);
    wordLevel.minimumScaleFactor = 0.3;

  widget.addSpacer(10);

    const location = widget.addText("ENTER_YOUR_LOCATION_HERE");
    location.textColor = textColor;
    location.font = Font.regularSystemFont(13);
    location.minimumScaleFactor = 0.5;

  widget.addSpacer(2);

    const updatedAt = new Date(data.ts * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const widgetText = widget.addText(`Updated ${updatedAt}`);
    widgetText.textColor = textColor;
    widgetText.font = Font.regularSystemFont(10);
    widgetText.minimumScaleFactor = 0.5;

    const purpleMapUrl = `https://www.purpleair.com/map?opt=1/i/mAQI/a10/cC5&select=${SENSOR_ID}#14/${data.lat}/${data.lon}`;
    widget.url = purpleMapUrl;
  } catch (error) {
    console.log(error);

    const errorWidgetText = widget.addText(`${error}`);
    errorWidgetText.textColor = Color.red();
    errorWidgetText.textOpacity = 30;
    errorWidgetText.font = Font.regularSystemFont(10);
  }
  
function createSymbol(name) {
  const font = Font.systemFont(20)
  const sym = SFSymbol.named(name)
  sym.applyFont(font)
  return sym 
}

// Background Formatting

const imageBackground = true
const forceImageUpdate = true

if (imageBackground) {
 
  const path = files.joinPath(files.documentsDirectory(), "weather-cal-image")
  const exists = files.fileExists(path)
  const createdToday = exists ? sameDay(files.modificationDate(path),currentDate) : false
  
  if (exists && !forceImageUpdate) { 
    widget.backgroundImage = files.readImage(path)
  
  } else if (!exists || forceImageUpdate) { 
    
    try {
      let img = await new Request("https://source.unsplash.com/collection/" + collection).loadImage()
      files.writeImage(path, img)
      widget.backgroundImage = img
    } catch {
      widget.backgroundImage = files.readImage(path)
    }
    
 }
    
}

/* RUN WIDGET */

 if (config.runsInApp) {
    widget.presentSmall();
  }

  Script.setWidget(widget);
  Script.complete();
}

await run();
