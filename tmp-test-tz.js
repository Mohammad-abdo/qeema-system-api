const tz = require("date-fns-tz");
console.log(Object.keys(tz));

const { fromZonedTime, toZonedTime, formatInTimeZone } = tz;
try {
  // Try using fromZonedTime if it exists
  const dStr = "2024-03-17";
  let start, end;
  
  if (tz.fromZonedTime) {
      console.log("has fromZonedTime");
      start = tz.fromZonedTime(`${dStr}T00:00:00`, "Africa/Cairo");
      end = tz.fromZonedTime(`${dStr}T23:59:59.999`, "Africa/Cairo");
  } else if (tz.zonedTimeToUtc) {
      console.log("has zonedTimeToUtc");
      start = tz.zonedTimeToUtc(`${dStr} 00:00:00`, "Africa/Cairo");
      end = tz.zonedTimeToUtc(`${dStr} 23:59:59.999`, "Africa/Cairo");
  } else {
    console.log("neither fromZonedTime nor zonedTimeToUtc found!");
  }
  console.log("Start:", start ? start.toISOString() : "null");
  console.log("End:", end ? end.toISOString() : "null");
} catch(e) {
  console.error(e);
}
