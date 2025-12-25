// ==UserScript==
// @name        Cost Per Pax myfly.club
// @namespace   Violentmonkey Scripts
// @match       https://play.myfly.club/*
// @grant       none
// @version     1.1
// @author      Alrianne
// @description Simulating cost per capacity on updating link
// @downloadURL https://raw.githubusercontent.com/wolfnether/Airline_Club_Mod/refs/heads/main/mfc_cost_per_pax.user.js
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
    let multiplier = 0;
    if (airportFrom.countryCode != airportTo.countryCode) {
        multiplier = Math.pow(activeLink.distance + 900, 0.16) - 1.5;
        basic = 4.75 * multiplier - 5.25;
    } else {
        multiplier = Math.pow(activeLink.distance + 600, 0.15) - 2;
        basic = 3.5 * multiplier - 1.25;
    }

    let staffPerFrequency = 0;

    switch(activeAirline.type) {
        case "Regional Partner": staffPerFrequency = multiplier * 0.1; break;
        case "Luxury": staffPerFrequency = multiplier * 0.2; break;
        default: staffPerFrequency = multiplier * 0.5; break;
    }

    let staffPer500Pax = 1.35 * multiplier;

    let durationInHour = linkModel.duration / 60;

    let maintenance = 0;
    let depreciationRate = 0;

    let price = model.price;
    if( model.originalPrice){
        price = model.originalPrice;
    }

    const capacity = [0,0,0];

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

        console.log(airplane)
        frequency += freq;

        capacity[0] += airplane.configuration.economy * freq;
        capacity[1] += airplane.configuration.business * freq;
        capacity[2] += airplane.configuration.first * freq;
    }

    if (frequency == 0){
        frequency = linkModel.maxFrequency;

        let flightTime = linkModel.flightMinutesRequired;
        let availableFlightMinutes = MAX_FLIGHT_MIN - flightTime;
        let utilisation = flightTime / (MAX_FLIGHT_MIN - availableFlightMinutes);
        let planeUtilisation = (MAX_FLIGHT_MIN - availableFlightMinutes) / MAX_FLIGHT_MIN;

        let decayRate = 100 / (model.lifespan * 3) * (1 + 2 * planeUtilisation);
        depreciationRate += Math.floor(price * (decayRate / 100) * utilisation);
        maintenance += model.capacity * 155 * utilisation * factor;

        capacity[0] = model.capacity * frequency;
    }

    const totalCapacity = capacity[0]+capacity[1]+capacity[2];

    let fuelCost = FUEL_UNIT_COST * calcFuelBurn(model, activeLink.distance) * frequency;
    fuelCost += fuelCost * (activeAirline.fuelTaxRate / 100);

    const crewCost = [0,0,0];
    const targetQualityCost = Math.pow(activeAirline.targetServiceQuality / 22, 1.95);
    crewCost[0] = Math.round((targetQualityCost + 6.75) * capacity[0] * 1.1 * durationInHour);
    crewCost[1] = Math.round((targetQualityCost + 6.75) * capacity[1] * 1.5 * durationInHour);
    crewCost[2] = Math.round((targetQualityCost + 6.75) * capacity[2] * 3.6 * durationInHour);
    const crewCostTotal = crewCost[0] + crewCost[1] + crewCost[2];

    let airportFees = fromSlotFee * plane_category * 0.9 + toSlotFee * plane_category * frequency + (airportFrom.size + airportTo.size - 1) * totalCapacity;

    const servicesCost = [0,0,0];
    servicesCost[0] = 1.1 * durationInHour * capacity[0] * serviceLevelCost;
    servicesCost[1] = 1.5 * durationInHour * capacity[1] * serviceLevelCost;
    servicesCost[2] = 3.6 * durationInHour * capacity[2] * serviceLevelCost;
    
    const servicesCostTotal = servicesCost[0] + servicesCost[1] + servicesCost[2];

    let cost = fuelCost + crewCostTotal + airportFees + depreciationRate + servicesCostTotal + maintenance;

    let staffTotal = Math.ceil(basic + staffPerFrequency * frequency + staffPer500Pax * totalCapacity / 500);

    const weight = [0,0,0];
    weight[0] = 1 * capacity[0] / totalCapacity;
    weight[1] = 2.5 * capacity[1] / totalCapacity;
    weight[2] = 6 * capacity[2] / totalCapacity;
    const totalWeight = weight[0] + weight[1] + weight[2];

    const costProRata = [weight[0]/totalWeight , weight[1]/totalWeight, weight[2]/totalWeight];
    costProRata[0] *= (cost - servicesCostTotal - crewCostTotal);
    costProRata[1] *= (cost - servicesCostTotal - crewCostTotal);
    costProRata[2] *= (cost - servicesCostTotal - crewCostTotal);

    costProRata[0] += crewCost[0] + servicesCost[0];
    costProRata[1] += crewCost[1] + servicesCost[1];
    costProRata[2] += crewCost[2] + servicesCost[2];

    $('#airplaneModelDetails #FCPF').text("$" + commaSeparateNumber(Math.round(fuelCost)));
    $('#airplaneModelDetails #CCPF').text("$" + commaSeparateNumber(crewCost[0]) + " | $" + commaSeparateNumber(crewCost[1]) + " | $" + commaSeparateNumber(crewCost[2])+  " | $" + commaSeparateNumber(crewCostTotal));
    $('#airplaneModelDetails #AFPF').text("$" + commaSeparateNumber(Math.round(airportFees)));
    $('#airplaneModelDetails #depreciation').text("$" + commaSeparateNumber(Math.floor(depreciationRate)));
    $('#airplaneModelDetails #SSPF').text("$" + commaSeparateNumber(Math.round(servicesCost[0])) + " | $" + commaSeparateNumber(Math.round(servicesCost[1])) + " | $" + commaSeparateNumber(Math.round(servicesCost[2])) + " | $" + commaSeparateNumber(Math.round(servicesCostTotal)));
    $('#airplaneModelDetails #maintenance').text("$" + commaSeparateNumber(Math.round(maintenance)));
    $('#airplaneModelDetails #cpp').text("$" + commaSeparateNumber(Math.round(capacity[0]==0?0:costProRata[0]/capacity[0])) + " | $" + commaSeparateNumber(Math.round(capacity[1]==0?0:costProRata[1]/capacity[1])) + " | $" + commaSeparateNumber(Math.round(capacity[2]==0?0:costProRata[2]/capacity[2])) + " | $" + commaSeparateNumber(Math.round(cost / totalCapacity)));
    $('#airplaneModelDetails #cps').text("$" + commaSeparateNumber(Math.round(cost / staffTotal)) + " * " + staffTotal);
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
  <h5>Maintenance :</h5>
 </div>
 <div class="value" id="maintenance"></div>
</div>
<div class="table-row">
 <div class="label">
  <h5>Crew cost:</h5>
 </div>
 <div class="value" id="CCPF"></div>
</div>
<div class="table-row">
 <div class="label">
  <h5>Service supplies:</h5>
 </div>
 <div class="value" id="SSPF"></div>
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
