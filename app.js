var express = require('express');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const moment = require("moment");
const axios = require('axios').default;


var app = express();

app.use(logger('dev'));
app.use(cookieParser());


async function getCaltrainStops() {
        const response = await axios.get(`https://api.511.org/transit/stops?operator_id=CT&api_key=a7869c71-f8f3-48af-b48b-544abe3c4486&format=json`);

        const caltrain = response.data.Contents.dataObjects.ScheduledStopPoint;
        //console.log(caltrain)

        let caltrainStops = []
        caltrain.map((stop, index) => {
                // Check if stop.Name contains the wod "Caltrain"
                if (stop.Name.includes("Caltrain") && !stop.Name.includes("Shuttle")) {
                        // Check if id is only a number
                        if (stop.id.match(/^[0-9]+$/)) {
                                caltrainStops.push(stop)
                        }

                }
        })

        // sort by id
        caltrainStops.sort((a, b) => {
                return a.id - b.id
        })



        return caltrainStops
}

async function getCaltrainDepartures(stopId) {
        // http://api.511.org/transit/StopMonitoring?api_key=[your_key]&agency=[operatorID]
        // &stopCode=[stopCode]&format=[json or xml]

        const response = await axios.get(`http://api.511.org/transit/StopMonitoring?api_key=a7869c71-f8f3-48af-b48b-544abe3c4486&agency=CT&stopCode=${ stopId }&format=json`);

        return response.data.ServiceDelivery.StopMonitoringDelivery.MonitoredStopVisit
}

async function getBartStops() {
        const response = await axios.get(`https://api.511.org/transit/stops?operator_id=BA&api_key=a7869c71-f8f3-48af-b48b-544abe3c4486&format=json`);

        const bart = response.data.Contents.dataObjects.ScheduledStopPoint;
        //console.log(caltrain)

        let bartStops = []
        // if stop.id does not contain '_ then it is a bart stop
        bart.map((stop, index) => {
                if (!stop.id.includes("_")) {
                        bartStops.push(stop)
                }
        })

        // sort alphabetically by id
        // id is a string of Uppercase letters
        bartStops.sort((a, b) => {
                return a.id.localeCompare(b.id)
        })

        return bartStops
}

async function getBartDepartures(stopId) {
        const response = await axios.get(`http://api.511.org/transit/StopMonitoring?api_key=a7869c71-f8f3-48af-b48b-544abe3c4486&agency=BA&stopCode=${ stopId }&format=json`);
        //console.log(response.data.ServiceDelivery.StopMonitoringDelivery.MonitoredStopVisit)
        return response.data.ServiceDelivery.StopMonitoringDelivery.MonitoredStopVisit
}



app.get('/test.xml', (req, res) => {
        // redirect to main.xml
        res.redirect('/main.xml')
})

app.get('/main.xml', function(req, res, next) {
    // send XML back
        console.log(req.hostname)
        console.log(`http://${ req.hostname }:${3000}/caltrain.xml`)

        res.set('Content-Type', 'text/xml');
        res.send(`
            <CiscoIPPhoneMenu>
              <Title>511</Title>
              <Prompt>Choose an Agency</Prompt>
              <MenuItem>
                <Name>Caltrain</Name>
                <URL>http://${ req.hostname }:${3000}/caltrain.xml
                </URL>
                <IconIndex>1</IconIndex>
                </MenuItem>
                <MenuItem>
                <Name>BART</Name>
                <URL>http://${ req.hostname }:${3000}/bart.xml
                </URL>
                <IconIndex>1</IconIndex>
                </MenuItem>
            </CiscoIPPhoneMenu>
        `);
});

app.get('/caltrain.xml', async function(req, res, next) {
        // send XML back


        let caltrainStops = await getCaltrainStops()

        //console.log(caltrainStops)
        // get rid of ever other stop, and trim the last digit of the stop id
        caltrainStops = caltrainStops.filter((stop, index) => {
                if (index % 2 === 0) {
                        stop.id = stop.id.slice(0, -1)
                        return stop
                }
        })

        // 511 token = a7869c71-f8f3-48af-b48b-544abe3c4486
        // TransitLand token = FXwXAY7jj3mUNv0v7oh0L9frxQSavUIu

        const menuItems = caltrainStops.map((stop, index) => {
            return `
                <MenuItem>
                    <Name>${ String(stop?.Name).replace('Caltrain Station', '') }</Name>
                    <URL>http://${ req.hostname }:${3000}/caltrain/${ stop.id }.xml
                    </URL>
                    <IconIndex>1</IconIndex>
                </MenuItem>
            `
        })

        //console.log(menuItems.length)


        res.set('Content-Type', 'text/xml');
        res.send(`
            <CiscoIPPhoneMenu>
              <Title>511</Title>
              <Prompt>Choose a Caltrain Station</Prompt>
              ${menuItems.join('')}
            </CiscoIPPhoneMenu>
        `);
});
app.get('/caltrain/:id.xml', async function(req, res, next) {
        // send XML back
        //console.log(req.hostname)
        //console.log(req.params.id)
        //console.log(String(req.params.id).length)
        const caltrainStops = await getCaltrainStops()




        /*
        * Caltrain stop ids are 5 digits long, however there's two ids for each stop, XXXX1 for northbound and XXXX2 for southbound
         */
        if (String(req.params.id).length === 4) {
                // find the stop with the id
                let stop = caltrainStops.find((stop) => {
                        return stop.id === `${String(req.params.id)}1`
                })

                //console.log(stop)

                if (!stop) {
                        stop = caltrainStops.find((stop) => {
                                return stop.id === `${String(req.params.id)}4`
                        })
                }

                res.set('Content-Type', 'text/xml');

                let name = String(stop?.Name).replace('Caltrain Station', '')
                if (name === 'South San Francisco') {
                        name = 'South SF'
                } else if (name === 'San Francisco') {

                }

                res.send(`
                    <CiscoIPPhoneMenu>
                      <Title>${String(stop?.Name).replace('Caltrain Station', '') || 'Stop'}</Title>
                      <Prompt>Choose a Direction</Prompt>
                      <MenuItem>
                        <Name>Northbound</Name>
                        <URL>http://${ req.hostname }:${3000}/caltrain/${String(req.params.id)}1.xml
                        </URL>
                        <IconIndex>1</IconIndex>
                        </MenuItem>
                        <MenuItem>
                        <Name>Southbound</Name>
                        <URL>http://${ req.hostname }:${3000}/caltrain/${String(req.params.id)}2.xml
                        </URL>
                        <IconIndex>1</IconIndex>
                        </MenuItem>
                    </CiscoIPPhoneMenu>
                `);
                return
        }

        if (String(req.params.id) === "253774") {
                res.set('Content-Type', 'text/xml');
                res.send(`
                     <CiscoIPPhoneText>
                           <Title>Stanford</Title>
                           <Prompt>lmao, die</Prompt>
                              <Text>you're not going to stanford</Text>
                         </CiscoIPPhoneText>
                `);
                return
        }

        const stop = caltrainStops.find((stop) => {
                return stop.id === `${String(req.params.id)}`
        })

        //console.log(stop)
        console.log(String(req.params.id).at(String(req.params.id).length - 1) === '1' ? 'Northbound' : 'Southbound')


        let ETDs = await getCaltrainDepartures(req.params.id)

        let etdText = ETDs.map((etd) => {
                let eta = moment(new Date(Date.parse(etd.MonitoredVehicleJourney.MonitoredCall.ExpectedArrivalTime))).fromNow()
                if (eta.includes('ago')) {
                        return
                }
                return `${etd.MonitoredVehicleJourney.FramedVehicleJourneyRef.DatedVehicleJourneyRef} (${etd.MonitoredVehicleJourney.LineRef}) - ${eta} (${String(new Date(Date.parse(etd.MonitoredVehicleJourney.MonitoredCall.ExpectedArrivalTime)).toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles' })).replace()})`
        })
        ETDs.forEach((etd) => {
                //console.log(etd)
        })



        res.send(`
            <CiscoIPPhoneText>
           <Title>${ String(stop?.Name).replace('Caltrain Station', '') }</Title>
           <Prompt>${String(req.params.id).at(String(req.params.id).length - 1) === '1' ? 'Northbound' : 'Southbound'}</Prompt>
              <Text>${ ETDs.length > 0 ? etdText.join('\n') : 'No Departures today'}</Text>
         </CiscoIPPhoneText>
        `);
});



app.get('/bart.xml', async function(req, res, next) {
        // send XML back


        let bartStops = await getBartStops()


        // 511 token = a7869c71-f8f3-48af-b48b-544abe3c4486
        // TransitLand token = FXwXAY7jj3mUNv0v7oh0L9frxQSavUIu

        const menuItems = bartStops.map((stop, index) => {
                return `
                <MenuItem>
                    <Name>${ String(stop.Name) }</Name>
                    <URL>http://${ req.hostname }:${3000}/bart/${ stop.id }.xml
                    </URL>
                    <IconIndex>1</IconIndex>
                </MenuItem>
            `
        })

        //console.log(menuItems.length)


        res.set('Content-Type', 'text/xml');
        res.send(`
            <CiscoIPPhoneMenu>
              <Title>511</Title>
              <Prompt>Choose a Bart Station</Prompt>
              ${menuItems.join('')}
            </CiscoIPPhoneMenu>
        `);
});

app.get('/bart/:id.xml', async function(req, res, next) {
        let bartStops = await getBartStops()

        console.log(req.ip)

        // get stop with id
        const stop = bartStops.find((stop) => {
                return stop.id === `${String(req.params.id)}`
        })

        //console.log(stop)

        let ETDs = await getBartDepartures(req.params.id)
        //console.log(ETDs.length)

        let etdText = ETDs.map((etd) => {
                let eta = moment(new Date(Date.parse(etd.MonitoredVehicleJourney.MonitoredCall.ExpectedArrivalTime))).fromNow()


                // make sure line string is always 7 chars long
                let line = `${String(etd.MonitoredVehicleJourney.LineRef).split("-")[0]} Line`
                if (line.length < 7) {
                        line += ' '.repeat(7 - line.length)
                }

                // make sure destination string is always 20 chars long
                let destination = String(etd.MonitoredVehicleJourney.DestinationName).split('/')[0]
                if (destination.length < 15) {
                        destination += ' '.repeat(15 - destination.length)
                }

                return `${line}${destination} - ${eta}`


        })
        let etdCharCount = 0
        etdText.forEach((etd) => {
                etdCharCount += etd.length
                // if adding this etd would put us over the 4000 char limit, remove it
                if (etdCharCount > 4000) {
                        etdText.pop()
                        etdCharCount -= etd.length
                }
        })

        res.set('Content-Type', 'text/xml');

        let name = String(stop.Name).split('/')[0].split('(')[0]
        if (name.includes('San Francisco International Airport')) {
                name = 'SFO'
        } else if (name.includes('Oakland International Airport')) {
                name = 'OAK'
        } else if (name.includes('Millbrae')) {
                name = 'Millbrae'
        }

        res.send(`
            <CiscoIPPhoneText>
           <Title>BART</Title>
           <Prompt>${ name }</Prompt>
              <Text>${ ETDs.length >= 0 ? etdText.join('\n') : 'No Departures today'}</Text>
         </CiscoIPPhoneText>
        `);


})

// create a route ("/stinkypoopoohead.xml") that returns XML of the CiscoIPPhoneImageFile of a URL
app.get('/stinkypoopoohead.xml', function(req, res, next) {
        // send XML back
        res.set('Content-Type', 'text/xml');
        res.send(`
            <CiscoIPPhoneImageFile>
              <Title>Stinky Poopoo Head</Title>
              <Prompt>Stinky Poopoo Head</Prompt>
              <LocationX>0</LocationX>
              <LocationY>0</LocationY>
              <URL>http://i.imgur.com/nD0mZUQ.png</URL>
            </CiscoIPPhoneImageFile>
        `);
})


module.exports = app;
