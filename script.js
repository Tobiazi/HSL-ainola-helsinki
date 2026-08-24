const API_URL = "https://api.digitransit.fi/routing/v2/hsl/gtfs/v1";
const API_KEY = "37cbdfbff8804032819d698cc43f9a25";

const stopsDict = {
    "Järvenpää": ["HSL:5010559"],
    "Helsinki": ["HSL:1020501"],
};

const stopOrder = Object.keys(stopsDict);
const maxResults = {
    "Järvenpää": 10,
    "Helsinki": 10,
};

function getSecondsFromMidnight() {
    const now = new Date();
    return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

function secondsToTime(seconds) {
    seconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

function buildQuery(stopId) {
    return `
    {
        stop(id: "${stopId}") {
            name
            stoptimesWithoutPatterns(numberOfDepartures: 10) {
                trip {
                    routeShortName
                }
                headsign
                scheduledDeparture
                realtimeDeparture
                departureDelay
                realtime
                realtimeState
            }
        }
    }
    `;
}

async function queryStopDepartureTimes(stopId) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "digitransit-subscription-key": API_KEY,
        },
        body: JSON.stringify({ query: buildQuery(stopId) }),
    });
    const data = await response.json();
    if (data.errors) {
        console.error("API Error:", data.errors);
        return null;
    }
    return data.data || {};
}

function sortFormatTimes(lists) {
    const mergedList = [];
    for (const lst of lists) {
        mergedList.push(...lst);
    }

    const nowSec = getSecondsFromMidnight();
    for (const item of mergedList) {
        let diff = item.realtimeDeparture - nowSec;
        if (diff < 0) diff += 86400;
        item.diff = diff;
    }

    mergedList.sort((a, b) => a.diff - b.diff);
    return mergedList;
}

async function fetchAllStops() {
    const depTimesDict = {};

    for (const [stopName, stopIds] of Object.entries(stopsDict)) {
        if (!Array.isArray(stopIds)) continue;

        const results = await Promise.all(
            stopIds.map(async (stopId) => {
                const items = await queryStopDepartureTimes(stopId);
                if (!items || !items.stop) return [];
                return items.stop.stoptimesWithoutPatterns || [];
            })
        );

        depTimesDict[stopName] = sortFormatTimes(results);
    }

    return depTimesDict;
}

function formatDuration(sec) {
    sec = Math.abs(Number(sec) || 0);
    const hh = String(Math.floor(sec / 3600)).padStart(2, "0");
    const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

async function updateDisplay() {
    document.getElementById("status").textContent = "Päivitetään...";

    try {
        const result = await fetchAllStops();

        let html = '<div class="stops-container">';
        let found = false;

        for (const stopName of stopOrder) {
            const departures = result[stopName];
            if (!Array.isArray(departures) || departures.length === 0) continue;
            found = true;

            const limit = maxResults[stopName] || 10;
            html += `<div class="route-group"><strong>${escapeHtml(stopName)}</strong>`;
            departures.slice(0, limit).forEach(dep => {
                const sec = dep.realtimeDeparture || dep.scheduledDeparture || 0;
                const time = secondsToTime(sec);

                const delay = Number(dep.departureDelay || 0);
                const depDelayType = delay > 0 ? "+" : delay < 0 ? "-" : "";
                const depDelayForm = formatDuration(delay);
                const depDelayClass = delay > 0 ? "late" : delay < 0 ? "early" : "";
                const depDelayDisplay = depDelayType ? `${depDelayType} ${depDelayForm}` : "";

                const route = dep.trip?.routeShortName || "?";
                const dest = dep.headsign || "Tuntematon";

                html += `<div class="departure">
                    <span class="time" data-departure-sec="${sec}">${time}</span>
                    <span class="route">${escapeHtml(route)}</span>
                    <span class="dest">${escapeHtml(dest)}</span>
                    <span class="delay ${depDelayClass}">${depDelayDisplay}</span>
                </div>`;
            });
            html += "</div>";
        }
        html += "</div>";

        document.getElementById("content").innerHTML = found ? html : '<div class="error">Lähtöjä ei löytynyt</div>';
        document.getElementById("status").textContent =
            `Päivitetty: ${new Date().toLocaleString("fi-FI", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
    } catch (error) {
        console.error("Error:", error);
        document.getElementById("content").innerHTML = `<div class="error">Virhe: ${error.message}</div>`;
        document.getElementById("status").textContent = "Päivitetty: virhe";
    }
}

function updateClock() {
    const now = new Date();
    document.getElementById("clock").textContent = now.toLocaleTimeString("fi-FI", { hour12: false });
}

function updateCountdowns() {
    const currentSec = getSecondsFromMidnight();
    document.querySelectorAll(".time").forEach(span => {
        const sec = Number(span.dataset.departureSec);
        const diff = sec - currentSec;
        let countdown = "";
        if (diff > 0 && diff <= 600) {
            countdown = ` (${formatDuration(diff)})`;
        }
        span.textContent = secondsToTime(sec) + countdown;
    });
}

updateClock();
setInterval(updateClock, 1000);
updateDisplay();
setInterval(updateDisplay, 5000);
setInterval(updateCountdowns, 1000);
