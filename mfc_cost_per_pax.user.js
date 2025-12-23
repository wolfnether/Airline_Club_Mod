// ==UserScript==
// @name        Cost Per Pax myfly.club
// @namespace   Violentmonkey Scripts
// @match       https://play.myfly.club/*
// @grant       none
// @version     1.0
// @author      -
// @description 22/12/2025 21:41:37
// ==/UserScript==

console.log("Plane score script loading");

//* Link Cost Preview

let _updatePlanLinkInfo = window.updatePlanLinkInfo;
let _updateTotalValues = window.updateTotalValues;

let activeLink;
let idFrom = -1;
let idTo = -1;
let airportFrom;
let airportTo;
let _modelId = -1;

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
        idFrom = linkInfo.fromAirportId
        $.ajax({
            url:"airports/" + linkInfo.fromAirportId,
            async : false,
            success: function(result){airportFrom = result},
        });
    }

    if (idTo != linkInfo.toAirportId){
        idTo = linkInfo.toAirportId
        $.ajax({
            url:"airports/" + linkInfo.toAirportId,
            async : false,
            success: function(result){airportTo = result},
        });
    }

    _updatePlanLinkInfo(linkInfo);
}

let _updateModelInfo = window.updateModelInfo;

var maintenanceFactorPopulated = false;
var factor = -1;

window.updateModelInfo = function(modelId) {
    if(!maintenanceFactorPopulated){
        $.ajax({
            type: 'GET',
            url: "airlines/" + activeAirline.id + "/maintenance-factor",
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            success: function(result) {
                factor = result.factor;
                maintenanceFactorPopulated = true;
                linkCostPerPax(modelId)
            }
        });
    } else {
        linkCostPerPax(modelId)
    }
}

function linkCostPerPax(modelId) {

    const MAX_FLIGHT_MIN = gameConstants.aircraft.maxFlightMin;
    const FUEL_UNIT_COST = gameConstants.linkCosts.fuelCost

    if (_modelId != modelId){
        _updateModelInfo(modelId);
    }
    _modelId = modelId;


    let model = loadedModelsById[modelId];
    let linkModel = activeLink.modelPlanLinkInfo.find(plane => plane.modelId == modelId);
    let serviceLevel = parseInt($("#planLinkServiceLevel").val());
    let frequency = 0;

    let plane_category = 0;
    let fromSlotFee = 0;
    let toSlotFee = 0;

    switch (airportFrom.size){
        case 1 : fromSlotFee=2;break;
        case 2 : fromSlotFee=4;break;
        case 3 : fromSlotFee=8;break;
        case 4 : fromSlotFee=16;break;
        case 5 : fromSlotFee=32;break;
        case 6 : fromSlotFee=64;break;
        case 7 : fromSlotFee=88;break;
        default: fromSlotFee=112;break;
    }

    switch (airportTo.size){
        case 1 : toSlotFee=2;break;
        case 2 : toSlotFee=4;break;
        case 3 : toSlotFee=8;break;
        case 4 : toSlotFee=16;break;
        case 5 : toSlotFee=32;break;
        case 6 : toSlotFee=64;break;
        case 7 : toSlotFee=88;break;
        default: toSlotFee=112;break;
    }

    switch (model.airplaneType.toUpperCase()) {
        case 'HELICOPTER'  : {
            plane_category = 2;
            fromSlotFee = 2;
            toSlotFee=2;
            break;
        }
        case 'REGIONAL'    : plane_category=3;break;
        case 'MEDIUM'      : plane_category=4;break;
        case 'MEDIUM_XL'   : plane_category=5;break;
        case 'LARGE'       : plane_category=8;break;
        case 'EXTRA_LARGE' : plane_category=10;break;
        case 'JUMBO'       : plane_category=16;break;
        case 'JUMBO_XL'    : plane_category=18;break;
        case 'SUPERSONIC'  : plane_category=12;break;
        default            : plane_category=2;
    }

    let serviceLevelCost = -5;

    switch (serviceLevel) {
        case 2:serviceLevelCost=-1;break;
        case 3:serviceLevelCost=4;break;
        case 4:serviceLevelCost=9;break;
        case 5:serviceLevelCost=15;break;
    }

    let basic = 0;
    let multiplyFactor = 2;
    if (airportFrom.countryCode != airportTo.countryCode) {
        multiplyFactor = Math.pow(activeLink.distance + 900, 0.16) - 1.5;
        basic = 4.75 * multiplyFactor - 5.25;
    } else {
        multiplyFactor = Math.pow(activeLink.distance + 600, 0.15) - 2;
        basic = 3.5 * multiplyFactor - 1.25;
    }

    let staffPerFrequency = multiplyFactor * 0.5;
    let staffPer500Pax = 1.35 * multiplyFactor;

    let durationInHour = linkModel.duration / 60;

    let maintenance = 0;
    let depreciationRate = 0;

    let price = model.price;
    if( model.originalPrice){
        price = model.originalPrice;
    }

    for (let row of $(".frequencyDetail .airplaneRow")) {
        let airplane = $(row).data("airplane");
        let freq = parseInt($(row).children(".frequency").val());
        let futureFreq = freq - airplane.frequency;
        let flightTime = freq * linkModel.flightMinutesRequired;

        let availableFlightMinutes = airplane.availableFlightMinutes - (futureFreq * linkModel.flightMinutesRequired);

        let utilisation = flightTime / (MAX_FLIGHT_MIN - availableFlightMinutes);
        let planeUtilisation = (MAX_FLIGHT_MIN - availableFlightMinutes) / MAX_FLIGHT_MIN;

        let decayRate = 100 / (model.lifespan * 3) * (1 + 2 * planeUtilisation);

        depreciationRate += Math.floor(price * (decayRate / 100) * utilisation);

        maintenance += model.capacity * 155 * utilisation * factor;

        console.log(utilisation)
        frequency += freq;
    }

    if (frequency == 0){
        frequency = linkModel.maxFrequency;

        let flightTime = linkModel.flightMinutesRequired;
        let availableFlightMinutes = MAX_FLIGHT_MIN - flightTime;
        let utilisation = flightTime / (MAX_FLIGHT_MIN - availableFlightMinutes);
        let planeUtilisation = (MAX_FLIGHT_MIN - availableFlightMinutes) / MAX_FLIGHT_MIN;

        let decayRate = 100 / (model.lifespan * 3) * (1 + 2 * planeUtilisation);
        depreciationRate += Math.floor(price * (decayRate / 100) * utilisation);
        maintenance += model.capacity * 155 * utilisation * factor;;
    }

    let fuelCost = FUEL_UNIT_COST * calcFuelBurn(model, activeLink.distance) * frequency;
    fuelCost += fuelCost * (activeAirline.fuelTaxRate / 100);

    let crewCost = (Math.pow(activeAirline.targetServiceQuality / 22, 1.95) + 6.75) * model.capacity * frequency * 1.1 * durationInHour;
    let airportFees = fromSlotFee * plane_category * 0.9 + toSlotFee * plane_category * frequency + (airportFrom.size + airportTo.size - 1) * model.capacity;
    let servicesCost = 1.1 * durationInHour * model.capacity * frequency * serviceLevelCost;

    let cost = fuelCost + crewCost + airportFees + depreciationRate + servicesCost + maintenance;

    let staffTotal = Math.floor(basic + staffPerFrequency * frequency + staffPer500Pax * model.capacity * frequency / 500);

    console.log(model, linkModel);

    $('#airplaneModelDetails #FCPF').text("$" + commaSeparateNumber(Math.floor(fuelCost)));
    $('#airplaneModelDetails #CCPF').text("$" + commaSeparateNumber(Math.floor(crewCost)));
    $('#airplaneModelDetails #AFPF').text("$" + commaSeparateNumber(Math.floor(airportFees)));
    $('#airplaneModelDetails #depreciation').text("$" + commaSeparateNumber(Math.floor(depreciationRate)));
    $('#airplaneModelDetails #SSPF').text("$" + commaSeparateNumber(Math.floor(servicesCost)));
    $('#airplaneModelDetails #maintenance').text("$" + commaSeparateNumber(Math.floor(maintenance)));
    $('#airplaneModelDetails #cpp').text("$" + commaSeparateNumber(Math.floor(cost / (model.capacity * frequency))) + " * " + (model.capacity * frequency));
    $('#airplaneModelDetails #cps').text("$" + commaSeparateNumber(Math.floor(cost / staffTotal)) + " * " + staffTotal);
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
  <h5>Airport fees :</h5>
 </div>
 <div class="value" id="AFPF"></div>
</div>
<div class="table-row">
 <div class="label">
  <h5>Depreciation :</h5>
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
  <h5>Maintenance :</h5>
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
 <div class="label">
  <h5>Cost per staff:</h5>
 </div>
 <div class="value" id="cps"></div>
</div>
<div class="table-row">
 <div class="label">&#8205;</div>
</div>`);

console.log("Plane score script loaded");
