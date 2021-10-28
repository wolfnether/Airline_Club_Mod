// ==UserScript==
// @name         Cost per PAX
// @namespace    http://tampermonkey.net/
// @version      0.2.5.1
// @description  try to take over the world!
// @author       Alrianne
// @match        https://*.airline-club.com/*
// @icon         https://www.google.com/s2/favicons?domain=airline-club.com
// @grant        none
// @updateURL    https://github.com/wolfnether/Airline_Club_Mod/raw/main/Cost_per_pax.user.js
// @downloadURL  https://github.com/wolfnether/Airline_Club_Mod/raw/main/Cost_per_pax.user.js
// ==/UserScript==
console.log("Plane score script loading");

function calcFlightTime(plane, distance){
    let min = Math.min;
    let max = Math.max;
    let speed = plane.speed * (plane.airplaneType.toUpperCase() == "SUPERSONIC" ? 1.5 : 1);
    let a = min(distance, 300);
    let b = min(max(0, distance-a), 400);
    let c = min(max(0, distance-(a+b)), 400);
    let d = max(0, distance-(a+b+c));

    let time_flight = a / min(speed, 350) + b / min(speed, 500) + c / min(speed, 700) + d / speed;
    return time_flight * 60;
}

function calcFuelBurn(plane, distance){
    let timeFlight = calcFlightTime(plane, distance);
    if (timeFlight > 1.5){
        return plane.fuelBurn * (405 + timeFlight);
    } else {
        return plane.fuelBurn * timeFlight * 5.5;
    }
}

window.updateAirplaneModelTable = function(sortProperty, sortOrder) {
    let distance = parseInt($("#fightRange").val());
    let runway = parseInt($("#runway").val());
    for (let plane of loadedModelsOwnerInfo) {
        if(plane.range < distance || plane.runwayRequirement > runway) {
            plane.cpp = -1;
            plane.max_rotation = -1;
        } else {
            var plane_category = -1;

            switch (plane.airplaneType.toUpperCase()) {
                case 'LIGHT':
                case 'SMALL' :plane_category=1;break;
                case 'REGIONAL' : plane_category=3;break;
                case 'MEDIUM' : plane_category=8;break;
                case 'LARGE' : plane_category=12;break;
                case 'X_LARGE' : plane_category=15;break;
                case 'JUMBO' : plane_category=18;break;
                case 'SUPERSONIC' : plane_category=12 ;break;
            }

            let flightDuration = calcFlightTime(plane, distance) ;
            let price = plane.price;
            if( plane.originalPrice){
                price = plane.originalPrice;
            }

            let maxFlightMinutes = 4 * 24 * 60;
            let frequency = Math.floor(maxFlightMinutes / ((flightDuration + plane.turnaroundTime)*2));

            let flightTime = frequency * 2 * (flightDuration + plane.turnaroundTime);
            let availableFlightMinutes = maxFlightMinutes - flightTime;
            let utilisation = flightTime / (maxFlightMinutes - availableFlightMinutes);
            let planeUtilisation = (maxFlightMinutes - availableFlightMinutes) / maxFlightMinutes;

            let decayRate = 100 / (plane.lifespan * 3) * (1 + 2 * planeUtilisation);
            let depreciationRate = Math.floor(price * (decayRate / 100) * utilisation);
            let maintenance = plane.capacity * 100 * utilisation;

            let airport_fee = (500 * plane_category + plane.capacity * 10) * 2;
            let crew_cost = plane.capacity * (flightDuration / 60) * 12 ;
            let inflight_cost = (20 + 8 * flightDuration / 60) * plane.capacity * 2;

            plane.max_rotation = frequency;
            plane.fbpf = calcFuelBurn(plane, distance);
            plane.fbpp = plane.fbpf / plane.capacity;
            plane.fbpw = plane.fbpf * plane.max_rotation;
            plane.cpp = ((plane.fbpf * 0.08 + airport_fee + inflight_cost + crew_cost) * plane.max_rotation + depreciationRate + maintenance) / (plane.capacity * plane.max_rotation);
        }
    }

    if (!sortProperty && !sortOrder) {
        var selectedSortHeader = $('#airplaneModelSortHeader .cell.selected')
        sortProperty = selectedSortHeader.data('sort-property')
        sortOrder = selectedSortHeader.data('sort-order')
    }
    //sort the list
    loadedModelsOwnerInfo.sort(sortByProperty(sortProperty, sortOrder == "ascending"));

    var airplaneModelTable = $("#airplaneModelTable")
    airplaneModelTable.children("div.table-row").remove()


    $.each(loadedModelsOwnerInfo, function(index, modelOwnerInfo) {
        if (modelOwnerInfo.cpp == -1) return;
        var row = $("<div class='table-row clickable' data-model-id='" + modelOwnerInfo.id + "' onclick='selectAirplaneModel(loadedModelsById[" + modelOwnerInfo.id + "])'></div>")
        if (modelOwnerInfo.isFavorite) {
            row.append("<div class='cell'>" + modelOwnerInfo.name + "<img src='assets/images/icons/heart.png' height='10px'></div>")
        } else {
            row.append("<div class='cell'>" + modelOwnerInfo.name + "</div>")
        }
        row.append("<div class='cell'>" + modelOwnerInfo.family + "</div>")
        row.append("<div class='cell' align='right'>" + commaSeparateNumber(modelOwnerInfo.price) + "</div>")
        row.append("<div class='cell' align='right'>" + modelOwnerInfo.capacity + " (" + (modelOwnerInfo.capacity * modelOwnerInfo.max_rotation)  + ")</div>")
        row.append("<div class='cell' align='right'>" + modelOwnerInfo.range + " km</div>")
        row.append("<div class='cell' align='right'>" + modelOwnerInfo.fuelBurn + "</div>")
        row.append("<div class='cell' align='right'>" + modelOwnerInfo.lifespan / 52 + " yrs</div>")
        row.append("<div class='cell' align='right'>" + modelOwnerInfo.speed + " km/h</div>")
        row.append("<div class='cell' align='right'>" + modelOwnerInfo.runwayRequirement + " m</div>")
        row.append("<div class='cell' align='right'>" + modelOwnerInfo.assignedAirplanes.length + "/" + modelOwnerInfo.availableAirplanes.length + "/" + modelOwnerInfo.constructingAirplanes.length + "</div>")
        row.append("<div class='cell' align='right'>" + modelOwnerInfo.max_rotation + "</div>")
        row.append("<div class='cell' align='right'>" + commaSeparateNumber(Math.round(modelOwnerInfo.cpp)) + "</div>")


        if (selectedModelId == modelOwnerInfo.id) {
            row.addClass("selected")
            selectAirplaneModel(modelOwnerInfo)
        }
        airplaneModelTable.append(row)
    });
}

$("#airplaneModelTable .table-header").append("<div class=\"cell\" style=\"width: 5%; border-bottom: none;\"></div>");
$("#airplaneModelTable .table-header").append("<div class=\"cell\" style=\"width: 5%; border-bottom: none;\"></div>");


$("#airplaneModelSortHeader").append("<div class=\"cell clickable\" style=\"width: 5%\" data-sort-property=\"max_rotation\" data-sort-order=\"ascending\" onclick=\"toggleAirplaneModelTableSortOrder($(this))\" align=\"right\">Max Freq.</div>");
$("#airplaneModelSortHeader").append("<div class=\"cell clickable\" style=\"width: 5%\" data-sort-property=\"cpp\" data-sort-order=\"ascending\" onclick=\"toggleAirplaneModelTableSortOrder($(this))\" align=\"right\">Cost per PAX</div>");

$("#airplaneCanvas .mainPanel .section .table .table-header:first").append("<div>Distance : <input type=\"text\" id=\"fightRange\" value=\"1000\"/><br>Runway length : <input type=\"text\" id=\"runway\" value=\"3000\"/></div>");

$("#fightRange").change(function(){window.updateAirplaneModelTable()});
$("#runway").change(function(){window.updateAirplaneModelTable()});

//* Link Cost Preview

let _updatePlanLinkInfo = window.updatePlanLinkInfo;
let _updateTotalValues = window.updateTotalValues;

let activeLink;
let idFrom = -1;
let idTo = -1;
let airportFrom;
let airportTo;
let _modelId;

let observer = new MutationObserver(function(mutations) {
    updateModelInfo(_modelId);
});

observer.observe(
    document.getElementById('planLinkServiceLevel'), {
        attributes: true,
        attributeFilter: ['value']
    }
);

window.updateTotalValues = function(){
    _updateTotalValues();
    window.updateModelInfo(_modelId);
}

window.updatePlanLinkInfo = function(linkInfo){
    console.log(linkInfo);
    activeLink = linkInfo;

    for (let model of activeLink.modelPlanLinkInfo){
        for (let airplane of model.airplanes){
            airplane.airplane.frequency = airplane.frequency;
        }
    }

    if (idFrom != linkInfo.fromAirportId){
        $.ajax({
            url:"airports/" + linkInfo.fromAirportId,
            async : false,
            success: function(result){airportFrom = result},
        });
    }

    if (idTo != linkInfo.toAirportId){
        $.ajax({
            url:"airports/" + linkInfo.toAirportId,
            async : false,
            success: function(result){airportTo = result},
        });
    }

    _updatePlanLinkInfo(linkInfo);
}

let _updateModelInfo = window.updateModelInfo;

window.updateModelInfo = function(modelId) {
    _updateModelInfo(modelId);
    _modelId = modelId;


    let model = loadedModelsById[modelId];
    let linkModel = activeLink.modelPlanLinkInfo.find(plane => plane.modelId == modelId);
    let serviceLevel = parseInt($("#planLinkServiceLevel").val());
    let frequency = 0;

    let plane_category = 0;

    switch (model.airplaneType.toUpperCase()) {
        case 'LIGHT':
        case 'SMALL' :plane_category=1;break;
        case 'REGIONAL' : plane_category=3;break;
        case 'MEDIUM' : plane_category=8;break;
        case 'LARGE' : plane_category=12;break;
        case 'X_LARGE' : plane_category=15;break;
        case 'JUMBO' : plane_category=18;break;
        case 'SUPERSONIC' : plane_category=12 ;break;
    }

    let baseSlotFee = 0;

    switch (airportFrom.size){
        case 1 :
        case 2 : baseSlotFee=50;break;
        case 3 : baseSlotFee=80;break;
        case 4 : baseSlotFee=150;break;
        case 5 : baseSlotFee=250;break;
        case 6 : baseSlotFee=350;break;
        default: baseSlotFee=500;break;
    }

    switch (airportTo.size){
        case 1 :
        case 2 : baseSlotFee+=50;break;
        case 3 : baseSlotFee+=80;break;
        case 4 : baseSlotFee+=150;break;
        case 5 : baseSlotFee+=250;break;
        case 6 : baseSlotFee+=350;break;
        default: baseSlotFee+=500;break;
    }

    let serviceLevelCost = 1;

    switch (serviceLevel) {
        case 2:serviceLevelCost=4;break;
        case 3:serviceLevelCost=8;break;
        case 4:serviceLevelCost=13;break;
        case 5:serviceLevelCost=20;break;
    }
    let durationInHour = linkModel.duration / 60;

    let price = model.price;
    if( model.originalPrice){
        price = model.originalPrice;
    }
    let baseDecayRate = 100 / model.lifespan;

    let maintenance = 0;
    let depreciationRate = 0;

    for (let row of $(".frequencyDetail .airplaneRow")) {
        let airplane = $(row).data("airplane");
        let freq = parseInt($(row).children(".frequency").val());
        let futureFreq = freq - airplane.frequency;
        let flightTime = freq * 2 * (linkModel.duration + model.turnaroundTime);

        let availableFlightMinutes = airplane.availableFlightMinutes - (futureFreq * 2 * (linkModel.duration + model.turnaroundTime));

        let utilisation = flightTime / (airplane.maxFlightMinutes - availableFlightMinutes);
        let planeUtilisation = (airplane.maxFlightMinutes - availableFlightMinutes) / airplane.maxFlightMinutes;

        let decayRate = 100 / (model.lifespan * 3) * (1 + 2 * planeUtilisation);

        depreciationRate += Math.floor(price * (decayRate / 100) * utilisation);

        maintenance += model.capacity * 100 * utilisation;

        frequency += freq;
    }

    if (frequency == 0){
        let maxFlightMinutes = 4 * 24 * 60;
        frequency = Math.floor(maxFlightMinutes / ((linkModel.duration + model.turnaroundTime)*2));

        let flightTime = frequency * 2 * (linkModel.duration + model.turnaroundTime);
        let availableFlightMinutes = maxFlightMinutes - flightTime;
        let utilisation = flightTime / (maxFlightMinutes - availableFlightMinutes);
        let planeUtilisation = (maxFlightMinutes - availableFlightMinutes) / maxFlightMinutes;

        let decayRate = 100 / (model.lifespan * 3) * (1 + 2 * planeUtilisation);
        depreciationRate += Math.floor(price * (decayRate / 100) * utilisation);
        maintenance += model.capacity * 100 * utilisation;
    }

    let fuelCost = frequency;

    if (linkModel.duration <= 90){
        fuelCost *= model.fuelBurn * linkModel.duration * 5.5 * 0.08;
    }else{
        fuelCost *= model.fuelBurn * (linkModel.duration + 405) * 0.08;
    }

    let crewCost = model.capacity * durationInHour * 12 * frequency;
    let airportFees = (baseSlotFee * plane_category + (Math.min(3, airportTo.size) + Math.min(3, airportFrom.size)) * model.capacity) * frequency;
    let servicesCost = (20 + serviceLevelCost * durationInHour) * model.capacity * 2 * frequency;
    let cost = fuelCost + crewCost + airportFees + depreciationRate + servicesCost + maintenance;

    $('#airplaneModelDetails #FCPF').text("$" + commaSeparateNumber(Math.floor(fuelCost)));
    $('#airplaneModelDetails #CCPF').text("$" + commaSeparateNumber(Math.floor(crewCost)));
    $('#airplaneModelDetails #AFPF').text("$" + commaSeparateNumber(airportFees));
    $('#airplaneModelDetails #depreciation').text("$" + commaSeparateNumber(Math.floor(depreciationRate)));
    $('#airplaneModelDetails #SSPF').text("$" + commaSeparateNumber(Math.floor(servicesCost)));
    $('#airplaneModelDetails #maintenance').text("$" + commaSeparateNumber(Math.floor(maintenance)));
    $('#airplaneModelDetails #cpp').text("$" + commaSeparateNumber(Math.floor(cost / (model.capacity * frequency))));
}

$("#airplaneModelDetails #speed").parent().after(`
<div class="table-row">
 <div class="label">&#8205;</div>
</div>
<div class="table-row">
 <div class="label">
  <h5>--  Costs  --</h5>
 </div>
</div>
<div class="table-row">
 <div class="label">
  <h5>Fuel cost:</h5>
 </div>
 <div class="value" id="FCPF"></div>
</div>
<div class="table-row">
 <div class="label">
  <h5>Crew cost:</h5>
 </div>
 <div class="value" id="CCPF"></div>
</div>
<div class="table-row">
 <div class="label">
  <h5>Airport fees:</h5>
 </div>
 <div class="value" id="AFPF"></div>
</div>
<div class="table-row">
 <div class="label">
  <h5>Depreciation (wip):</h5>
 </div>
 <div class="value" id="depreciation"></div>
</div>
<div class="table-row">
 <div class="label">
  <h5>Service supplies:</h5>
 </div>
 <div class="value" id="SSPF"></div>
</div>
<div class="table-row">
 <div class="label">
  <h5>Maintenance (wip):</h5>
 </div>
 <div class="value" id="maintenance"></div>
</div>
<div class="table-row">
 <div class="label">
  <h5>Cost per PAX:</h5>
 </div>
 <div class="value" id="cpp"></div>
</div>
<div class="table-row">
 <div class="label">&#8205;</div>
</div>`);

console.log("Plane score script loaded");
