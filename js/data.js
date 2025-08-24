var updateRate = 120000; //how long after the last data point to look for a new one
var channelIDs = [2010573];
var activeIndex = 0; //index of channelIDs that's currently active
var fieldNames = ["CO₂", "Temperature", "Humidity"];
var imperialUnits = [" (ppm)", " (°F)", " (%)"];
var DataStore = [];
var newData = [];
var charts = [];
var hours;

getInitialSettings();
getAndUpdate(channelIDs);
setInterval(lookForUpdate, 1000, channelIDs);

function getInitialSettings(){
    hours = document.getElementById("timespan_selector").value;
}

function updateSettings(){
    hours = document.getElementById("timespan_selector").value;
    initializePlots(activeIndex, hours);
}

function makeActive(id){
    document.getElementById(id).classList.add('active');
    document.getElementById((id+1)%2).classList.remove('active');
    if (id != activeIndex){
        activeIndex = id;
        initializePlots(activeIndex, hours);
    }
}

async function getAndUpdate(channels) {
    for (let i=0; i<channels.length; i++){
        console.log("Channel ID: " + channels[i]);

        var url = "https://api.thingspeak.com/channels/" + channels[i] + "/feeds?results=";
        var res;
        var json;

        if (typeof DataStore[channels[i]] == 'undefined'){
            res = await fetch(url+"8000");
            json = await res.json();
            DataStore[channels[i]] = json.feeds;
            DataStore[channels[i]].map(row => {
                row.created_at = Date.parse(row.created_at);
                return row;
            });

        } else {
            res = await fetch(url+"1");
            json = await res.json();
            newData[channels[i]] = json.feeds;
            newData[channels[i]].map(row => {
            row.created_at = Date.parse(row.created_at);
            return row;
            });

            if (newData[channels[i]][0].entry_id > DataStore[channels[i]][DataStore[channels[i]].length-1].entry_id){
                DataStore[channels[i]].push(...json.feeds);
                DataStore[channels[i]].shift();

            } else {
                console.log("No New Data...")
            }
            }
        initializePlots(activeIndex, hours);
        console.log(DataStore);
    }
}


function lookForUpdate(channels){
    for (let i=0; i<channels.length; i++){
        if ((Date.now() - DataStore[channels[i]][DataStore[channels[i]].length - 1].created_at) > updateRate){
            console.log("Fetching New...");
            getAndUpdate([channels[i]]);
        }
    }
}


function rolledAverage(col, n){
    var avg = [];
    var idx = 0;
    for (let i=0; i<col.length; i++){
        if (i%n == 0){
            if (i != 0){
                avg[idx] = sum / n;
                idx++;
            }
            var sum = col[i];
        } else {
            sum = sum + col[i];
        }
    }
    return avg;
}

function initializePlots(idx, plotHours){
    var t = DataStore[channelIDs[idx]].map(row => row.created_at);
    //t = rolledAverage(t,plotHours);

    var msk = t.reduce(function(arr, e, i){
        if (Date.now()-e <= plotHours*3600000) arr.push(i);
        return arr;
    },[]);

    t = msk.map(x=> new Date(Math.round(t[x])).toISOString());

    for(let i = 1; i<4; i++){
        var y = DataStore[channelIDs[idx]].map(col => col[`field${i}`]);
        y = y.map(element => parseFloat(element));
        //y = rolledAverage(y,plotHours)
        y = msk.map(x=>Math.round(y[x]*100)/100);
        
        var activeField = imperialUnits[i-1];

        switch (plotHours){
            case "1":
                var str = "Over the last hour.";
                var str2 = "since one hour ago.";
                var step = "minute";
                var sz = 10;
            break;

            case "12":
                var str = "Over the last 12 hours.";
                var str2 = "since twelve hours ago.";
                var step = "hour"
                var sz = 1;
            break;

            case "24":
                var str = "Over the last day.";
                var str2 = "since one day ago.";
                var step = "hour"
                var sz = 2;
            break;

            case "72":
                var str = "Over the last 3 days.";
                var str2 = "since three days ago.";
                var step = "hour"
                var sz = 6
            break;

            case "120":
                var str = "Over the last 5 days.";
                var str2 = "since five days ago.";
                var step = "day"
                var sz = 1;
            break;
        }

        var parentFeature = document.getElementById("field"+i);
        parentFeature.getElementsByClassName("card-title")[0].innerHTML = fieldNames[i-1] + activeField
        parentFeature.getElementsByClassName("card-subtitle")[0].innerHTML = str;

        var currentParentFeature = document.getElementById("current"+i);
        currentParentFeature.getElementsByClassName("card-title")[0].innerHTML = fieldNames[i-1] + activeField
        currentParentFeature.getElementsByClassName("text-muted")[0].innerHTML = str2;
        currentParentFeature.getElementsByClassName("mt-1")[0].innerHTML = y[y.length-1] + activeField;

        var change = Math.round((y[y.length-1]-y[0])*100)/100;

        if (change > 0){
            currentParentFeature.getElementsByClassName("mdi")[0].innerHTML = "Up " + change + activeField;
            currentParentFeature.getElementsByClassName("chg")[0].classList.add('text-danger');
            currentParentFeature.getElementsByClassName("chg")[0].classList.remove('text-success');
        } else if (change < 0){
            currentParentFeature.getElementsByClassName("mdi")[0].innerHTML = "Down " + Math.abs(change) + activeField;
            currentParentFeature.getElementsByClassName("chg")[0].classList.remove('text-danger');
            currentParentFeature.getElementsByClassName("chg")[0].classList.add('text-success');
        } else {
            currentParentFeature.getElementsByClassName("mdi")[0].innerHTML = "No change "
        }

        var ctx = parentFeature.getElementsByTagName("canvas")[0].getContext("2d");
        var gradient = ctx.createLinearGradient(0, 0, 0, 225);
        gradient.addColorStop(0, "rgba(215, 227, 244, 1)");
        gradient.addColorStop(1, "rgba(215, 227, 244, 0)");
        // Line chart
        if (typeof charts[i] != 'undefined'){
            charts[i].destroy();
        }
        charts[i] = new Chart(ctx, {
            type: "line",
            data: {
                labels: t,
                datasets: [{
                    label: fieldNames[i-1] + activeField,
                    fill: true,
                    backgroundColor: gradient,
                    borderColor: window.theme.primary,
                    data: y
                }]
            },
            options: {
                animation: false,
                maintainAspectRatio: false,
                elements: {
                    point:{
                        radius: 0
                    }
                },
                legend: {
                    display: false
                },
                tooltips: {
                    intersect: false
                },
                hover: {
                    intersect: true
                },
                plugins: {
                    filler: {
                        propagate: false
                    }
                },
                scales: {
                    xAxes: [{
                        type: 'time',
                        time: {
                            unit:step,
                            stepSize: sz,
                        },
                        reverse: true,
                        gridLines: {
                            display: false,
                            color: "rgba(0,0,0,0.0)"
                        }
                    }],
                    yAxes: [{
                        ticks: {
                            stepSize: Math.round((Math.max(...y)-Math.min(...y))/10)
                        },
                        display: true,
                        borderDash: [3, 3],
                        gridLines: {
                            color: "rgba(0,0,0,0.1)"
                        }
                    }]
                }
            }
        });
    }
}