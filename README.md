# FordConnect Simulator

This simulator is only intended for use by someone that is already authorized by Ford to use the FordConnect API, for example [Ford Smart Vehicle Connectivity Challenge](https://fordsmart.devpost.com/).
Please ensure you also test your application against the real FordConnect API, using a test VIN if needed.

The purpose of this project is to simulate the FordConnect API while enabling the engineer
to test various scenarios without having to have a vehicle to perform the test scenarios. For
example, you might want to change the location of the vehicle, change fuel level, etc.  
This simulator is intented to run on your local development environment exposing an HTTP endpoint that looks similar to the FordConnect API.  

This simulator was created to try to assist engineers that are using the FordConnect API but don't have access to a physical vehicle for test scenarios.  Development for this simulator was done without having a physical vehicle connected to the API, so there are possible bugs.  Please report any issues at the [github issues](https://github.com/jamisonderek/ford-connect-sim/issues) page.  In addition to testing your application using the simulator, please ensure you test your application against the real FordConnect API.

## Starting the simulator
This project requires you have [Node.js](https://nodejs.org/en/download/) and npm installed.  This version was developed and testing using Node version 15.5.1, npm 7.17.0 and Windows 10 (19042.1052).  You can check your vesrions by using the following command:
```
node --version
npm install npm@latest -g
npm --version
winver
```

Download the code to your local computer.  You can either clone the [repository](https://github.com/jamisonderek/ford-connect-sim), or from the github repository click on the Code button and choose Download ZIP (which you can then extract into some folder on your local computer.)

To install the projects dependencies make sure you are in the same directory as the package.json file and then type the following command:
```
npm ci
```
When it finishes you should have a folder called node_modules with a couple hundred directories in it.

The above steps only need to be performed one time, however running the _npm ci_ command multiple times will not hurt anything.

If desired you can set any [supported environment variables](#supported-environment-variables), for example running on a custom http port number.

If you want the simulator to also respond on https port 3000, you need to create and save a **cert.pfx** file in the root of the project.  There are many ways to create a certificate, but one of the
easier methods is to download the certificate generator from [PluralSight](https://www.pluralsight.com/blog/software-development/selfcert-create-a-self-signed-certificate-interactively-gui-or-programmatically-in-net) -- at the bottom of the page you should see a "Download the project here" link.  The password you choose for the certificate should also be saved in the **FORDSIM_PASSPHRASE** environment variable.

You must also set the **FORD_CLIENTSECRET** with the secret value to authenticate to the FordConnect API when cloning vehicles. (NOTE: this is FORD_ not FORDSIM_ since it refers to Ford's servers not the simulator).  You can find this value in your Postman environment settings.  

Now that you have all of your dependencies installed and any environment variables set, you are ready to start the server using the following command:
```
node app
```
You should get console output similar to the following...
```
Listening on port 80
Code is: Code1623699743125
```

**Congratulations!!!** At this point you are ready to start sending API calls to your server.

### Troubleshooting
If you get something like
<font color='#0F0'>Error: listen EADDRINUSE: address already in use :::80</font> then that means you either have another copy of the simulator running or some other service is running on that port.  In that case you should set the FORDSIM_HTTPPORT to a different value, like 8080.

If you get something like
<font color='#0F0'>Error starting HTTPS server. Error: ENOENT: no such file or directory, open './cert.pfx'</font> be sure you followed the [directions](#starting-the-simulator) for creating the cert.pfx file.

If you get something like
<font color='#0F0'>Error starting HTTPS server. Error: mac verify failure</font> be sure that you set the FORDSIM_PASSPHRASE environment variable correctly.

## Supported Environment Variables:
When the simulator starts, it will look for the following optional environment variables:

|variable|example value|default value|notes|
|--------|-------------|-------------|-----|
FORDSIM_HTTPPORT|80|80|The HTTP port that the service will listen on.
FORDSIM_CODE|SomeCode|auto-generated|The code needed for the initial call to the oauth2 service. You can enter any special access code.  The code will be good for 20 minutes. This value will be displayed when the server starts.
FORDSIM_TOKEN|SomeToken|auto-generated|The code needed for invoking APIs. Typically it is preferred that the caller use the oauth2 route to retrieve the token, but for initial testing this value may be used. This will be displayed when the server starts if it was set by the user. 
FORDSIM_TIMEOUT|300|1200|Number of seconds before code + access token expire.  Reducing this value is useful for testing your application's ability to refresh the token.  Generally, you should also update your application to have the same thresholds (so you are auto-refreshing the token instead of getting a access token expired message).
FORDSIM_CMDTIMEOUT|180|120|Number of seconds before a returned commandId value expires and return HTTP 401.
FORDSIM_PASSPHRASE|password|(none)|The password to the cert.pfx file for running on https://localhost:3000.
FORD_CLIENTSECRET|T_SuperSecret123|(See postman environment variables)|Secret used to authenticate to the FordConnect API servers provided by Ford.
FORD_CODE|CODE1234-1234-1234|(none)|Typically leave blank. Sets the code value passed to the FordConnect API oauth server when authenticating cloning vehicles.
FORD_REFERSH|eySomething|(none)|Typeically leave blank. Sets the refresh value passed to the FordConnect API oauth server when authenticating to clone vehicles.


## Known differences between the simulator the FordConnect API
Error descriptions/messages are not idential to real server, but status codes should match.  See [Known issues](#known-issues).


## Updating the mock vehicles
To add a new mock ICE (Internal Combustion Engine) vehicle to the simulator, do the following:
1. Update vehicles.js with a JSON object assigned to exports.ice# (replacing # with a unique value.)
The fields exposed should be similar to those exposed by the exports.ice1 object.  These are 
core attributes like vehicleId, name, etc.
   1. If you want to use the vehicle be sure to se modemEnabled=true (so it can send/receive commands), serviceCompatible=true (so it supports the APIs), vehicleAuthorizationIndicator=1 (so you allow
  the vehicles to accept commands).
   1. "Get Vehicle List" will work even if the values are all false/0.
1. Update vehicles.js with a JSON object assigned to exports.ice#_info (replacing # with the same value
as used in the previous step.)
   1. Make sure the EngineType is set to 'ICE'.
   1. Make sure the ChargingStatus.value is set to 'EvseNotDetected'.
   1. Make sure the PlugStatus.value is set to false.
1. Add the following code to app.js after the existing vehicles.push commands. (replace # with the same value as used in previous steps.  You can replace the png values with names of files in your images folder.)
    ```
    vehicles.push({
      vehicle: mockVehicles.ice#,
      info: mockVehicles.ice#_info,
      extra: makeExtra('full-image.png', 'thumbnail.png'),
    });
    ```
1. If your serviceCompatible=false or vehicleAuthorizationIndicator=0 you should use the following code instead: (replace # with the same value as used in previous steps.)
    ```
    vehicles.push({
      vehicle: mockVehicles.ice#,
      info: undefined,
      extra: makeExtra('full-image.png', 'thumbnail.png'),
    });
    ```

## Endpoints
When the simulator first starts, it will display a code that is good for 20 minutes.  Configure Postman the same as used in the FordConnect API.

In Postman open the "Ford Get Token" call.  Right click on the tab and choose "Duplicate tab".  In the duplicate tab, rename it to "Ford Get Token Simulator".  Update the path to be http://localhost:80/oauth2/v2.0/token  (If your server is running on a different port, use that number instead of 80.)  Switch to the body tab and in the **code** field, type in the code.  Click the Send button.  The output response will have an access token and a refresh token (the tests tab in Postman will automatically update your two postman environment variables with the new values.)

Next, in Postman open the "Ford Get Refresh Token" call.  Right click on the tab and choose "Duplicate tab".  In the duplicate tab, rename it to "Ford Get Refresh Token Simulator".  Update the path to be http://localhost:80/oauth2/v2.0/token  (If your server is running on a different port, use that number instead of 80.)  Click the Send button.  The output response will have an access token and a refresh token (the tests tab in Postman will automatically update your two postman environment variables with the new values.)  Whenever your API token expires (every 20 minutes) you can come back here to get a new token.

Next, in Postman open the "Get Vehicle List".  Right click on the tab and choose "Duplicate tab".  Rename the duplicate tab.  Update the path to be http://localhost:80/api/fordconnect/vehicles/v1 (notice how you are just changing the domain name & leaving everything else the same.  (If your server is running on a different port, use that number instead of 80.)  You could replace it with something like {{domain}}/api/fordconnect/vehicles/v1 and then in postman set an environment variable called domain to http://localhost:80.)  You will do this for all of the remaining APIs as well.  Click the Send button.  A list of vehicles will be displayed.  Pick a vehicle that has vehicleAuthorizationIndicator set to 1 and notice what its vehicleId is.  Update the postman environment variable vehicleId with this new id.  TIP: To make it easier, you could update vehicles.js to have your simulated vehicleId match the same value as your FordConnect vehicleId.

All of the other APIs should work (you just need to change their domain to http://localhost:80)

NOTE: At some point you will want to swtich back to using the FordConnect API, you must make sure your refresh token is from either the "Ford Get Token" or "Ford Get Refresh Token" service (you can see it in the output window from your last successful call to either API).  Open the environment variables, scroll down to refreshToken and make sure your current value is correct.  Once it is correct, click the Send button on the "Ford Get Refresh Token".  Don't forget to also update your vehicleId.

|verb|route|Postman Name|
|----|-----|------------|
POST|/oauth2/v2.0/token (grant_type=authorization_code)|Ford Get Token
POST|/:guid/oauth2/v2.0/token (grant_type=authorization_code)|Ford Get Token
POST|/oauth2/v2.0/token (grant_type=refresh_token)|Ford Get Refresh Token
POST|/:guid/oauth2/v2.0/token (grant_type=refresh_token)|Ford Get Refresh Token
GET|api/fordconnect/vehicles/v1||Get Vehicle List
POST|api/fordconnect/vehicles/v1/:vehicleId/unlock|Unlock Vehicle
GET|api/fordconnect/vehicles/v1/:vehicleId/unlock/:unlockCommandId|Unlock Command Status
POST|api/fordconnect/vehicles/v1/:vehicleId/lock|Lock Vehicle
GET|api/fordconnect/vehicles/v1/:vehicleId/lock/:lockCommandId|Lock Command Status
POST|api/fordconnect/vehicles/v1/:vehicleId/startEngine|Start Engine
GET|api/fordconnect/vehicles/v1/:vehicleId/startEngine/:startCommandId|Start Command Status
POST|api/fordconnect/vehicles/v1/:vehicleId/stopEngine|Stop Engine
GET|api/fordconnect/vehicles/v1/:vehicleId/stopEngine/:stopCommandId|Start Command Status
POST|api/fordconnect/vehicles/v1/:vehicleId/wake|Wake 
POST|api/fordconnect/vehicles/v1/:vehicleId/startCharge|Start Charge
POST|api/fordconnect/vehicles/v1/:vehicleId/stopCharge|Stop Charge
GET|api/fordconnect/vehicles/v1/:vehicleId/chargeSchedules|Get charge schedule
GET|api/fordconnect/vehicles/v1/:vehicleId/departureTimes|Get departure times
POST|api/fordconnect/vehicles/v1/:vehicleId/status|Vehicle Status
GET|api/fordconnect/vehicles/v1/:vehicleId/statusrefresh|Vehicle Status
GET|api/fordconnect/vehicles/v1/:vehicleId|Vehicle Information
POST|api/fordconnect/vehicles/v1/:vehicleId/location|Vehicle Location
GET|api/fordconnect/vehicles/v1/:vehicleId/location|Vehicle Location
GET|api/fordconnect/vehicles/v1/:vehicleId/images/thumbnail|Get Vehicle Image Thumbnail
GET|api/fordconnect/vehicles/v1/:vehicleId/images/full|Get image Full

## Changing simulation data
For more information about the simulation routes, please look in app.js file, search for your route name, like "('/sim/today" (without the quotes).  The comments should show more information about the parameters.<br/>
**NOTE:** You can import "simulator.json" into Postman for example usage of these routes. 

|route|params (*=optional)|example|comments|
|-----|------|-------|-------|
|GET /sim|||Returns the vehicles in the simulator
|/sim/clone|body: refresh_token|refresh_token=ey....|Clones the FordConnect API response for the user returned by the refresh_token.  This will import the test vehicles from the account and let you modify their state. 
|/sim/today|day, time|day=FRIDAY&time=13:15|Set the simulator's today value (used for determining the next departure time.)
|/sim/psi/:vehicleId|warning|warning=true|Sets the tirePressureWarning on a vehicle.
|/sim/modem/:vehicleId|enabled|enabled=false|Sets the modem on a vehicle.
|/sim/deepsleep/:vehicleId|sleep|sleep=false|Sets the deep sleep for the vehicle.
|/sim/firmware/:vehicleId|upgrade|upgrade=true|Sets the firmwareUpgradeInProgess on a vehicle.
|/sim/plug/:vehicleId|connected|connected=true|Sets the plug status on an EV vehicle.
|/sim/ignition/:vehicleId|value|value=on|Sets the ignition status on the vehicle.
|/sim/fuel/:vehicleId|level, dte|level=100.0&dte=700.0|Sets the fuel level on an ICE vehicle. "level" is a percentage, "dte" (distance to empty) is in km not miles.
|/sim/battery/:vehicleId|level, dte|level=100.0&dte=400.0|Sets the battery level on an EV vehicle. "level" is a percentage, "dte" (distance to empty) is in km not miles.
|/sim/location/:vehicleId|lat, long, distance, speed*, direction*|lat=36.105539&long=-95.885703&distance=3.1|Sets the location of a vehicle. You can optionally specify a speed and direction (like NorthWest).
|/sim/door/:vehicleId|door, state, role*|door=UNSPECIFIED_FRONT&role=DRIVER&state=OPEN|Opens or closes a door on the vehicle.
|/sim/alarm/:vehicleId|enabled|enabled=true|Sets the alarm for the vehicle.

## Populating with real vehicles
If you created a cert.pfx file and set the FORDSIM_PASSPHRASE and FORD_CLIENTSECRET environment variables, then an additional server should be listening on port 3000.  Use your account linking url (https://fordconnect.cv.ford.com/...) and login to FordConnect's FordPass with your username and password.  You will see a list of vehicles you have registered.  Select one of the vehicles that is compatible with the service, then click the "Authorize" button.  This will redirect you back to localhost:3000 and clone all of the vehicle in your account that you authorized.

NOTE: The data displayed is from the clone, it is not updated as the simulator changes state.

Once you have cloned your vehicle, you can invoke [https://localhost:3000/quit](https://localhost:3000/quit) to shut down the listner on port 3000 that clones vehicles.  You would typically do this if your own application has a listener on port 3000.

## Exposing your simulator on the Internet
You can expose your simulator from your local development environment onto the internet using ngrok.  To use ngrok, simply follow the directions at https://dashboard.ngrok.com/get-started/setup.  IF you don't already have an account, click "Sign up for free" at the bottom of the login page.  After you signup, you many need to reload the above url.
The steps are basically:
1. Download ngrok and extract it from the zip file.
1. Associate your authtoken (displayed in step 2 of the dashboard directions.)
   ```
   ngrok authtoken your-token-goes-here
   ```
1. Start ngrok listening on your port (like 80)
   ```
   Run *ngrok http 80*
   ```
1. Start sending requests to your forwarding address.  For example https://f4460d6eed92.ngrok.io/api/fordconnect/vehicles/v1.
1. You can also open the Web Interface to see the requests and more details.  For example http://127.0.0.1:4040 which allows you to click on a request and see the data (sent/received) and even replay the request while modifying some of the data.  

Always carefully monitor your computer usage when you make services available online.  The ford-connect-simulator has not gone through a security review, so it's possible a route could expose sensitive data. 

## Running tests
The following command will run the tests against the simulator
```
npm test
```

## Known issues
The following issues will be addressed in a future update.
1. The app.js file has lots of "TEST:", "REVIEW:" and "TODO:" comments, which still need to be addressed.
1. During error paths the simulator doesn't correctly response to all APIs correctly. For example you may get a HTTP 401 instead of an HTTP 406 status code.

Please report any additional issues at the [github issues](https://github.com/jamisonderek/ford-connect-sim/issues) page.

The following issues are by design and are not planned on being updated:
1. The messages returned by the simulator are different than production.

