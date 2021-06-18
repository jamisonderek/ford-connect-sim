# FordConnect Simulator

This simulator is only intended for use by someone that is already authorized by Ford to use the FordConnect API, for example [Ford Smart Vehicle Connectivity Challenge](https://fordsmart.devpost.com/).
Please ensure you also test your application against the real FordConnect API, using a test VIN if needed.

The purpose of this project is to simulate the FordConnect API while enabling the engineer
to test various scenarios without having to have a vehicle to perform the test scenarios. For
example, you might want to change the location of the vehicle, change fuel level, etc.  
This simulator is intented to run on your local development environment exposing an HTTP endpoint that looks similar to the FordConnect API.  

This simulator was created to try to assist engineers that are using the FordConnect API but don't have access to a physical vehicle for test scenarios.  Development for this simulator was done without having a physical vehicle connected to the API, so there are possible bugs.  Please report any issues at the [github issues](https://github.com/jamisonderek/ford-connect-sim/issues) page.  In addition to testing your application using the simulator, please ensure you test your application against the real FordConnect API.

## Work-in-progress
This simulator is currently a work in progress.  Please see the list of [Known issues](#known-issues).

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

## Supported Environment Variables:
When the simulator starts, it will look for the following optional environment variables:

|variable|example value|default value|notes|
|--------|-------------|-------------|-----|
FORDSIM_HTTPPORT|80|80|The HTTP port that the service will listen on.
FORDSIM_CODE|SomeCode|auto-generated|The code needed for the initial call to the oauth2 service. You can enter any special access code.  The code will be good for 20 minutes. This value will be displayed when the server starts. 
FORDSIM_TOKEN|SomeToken|auto-generated|The code needed for invoking APIs. Typically it is preferred that the caller use the oauth2 route to retrieve the token, but for initial testing this value may be used. This will be displayed when the server starts if it was set by the user. 
FORDSIM_TIMEOUT|300|1200|Number of seconds before code + access token exppire.  Reducing this value is useful for testing your application's ability to refresh the token.  Generally, you should also update your application to have the same thresholds (so you are auto-refreshing the token instead of getting a access token expired message).

## Known differences between the simulator the FordConnect API
Error descriptions/messages are not idential to real server, but status codes should match.  See [Known issues](#known-issues).

The oauth2 route is slightly different path than the real route.  Also, the oauth2 route uses the server provided value for the 'code' variable (**not** the real code from authenticating with Ford APIs.)

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
1. Add the following code to app.js after the existing vehicles.push commands. (replace # with the same value as used in previous steps.)
    ```
    vehicles.push({
      vehicle: mockVehicles.ice#,
      info: mockVehicles.ice#_info,
      extra: makeExtra(mockVehicles.ice#_info),
    });
    ```
1. If your serviceCompatible=false or vehicleAuthorizationIndicator=0 you should use the following code instead: (replace # with the same value as used in previous steps.)
    ```
    vehicles.push({
      vehicle: mockVehicles.ice#,
      info: undefined,
      extra: undefined,
    });
    ```

## Endpoints
When the simulator first starts, it will display a code that is good for 20 minutes.  Configure Postman the same as used in the FordConnect API.

In Postman open the "Ford Get Token" call.  Right click on the tab and choose "Duplicate tab".  In the duplicate tab, rename it to "Ford Get Token Simulator".  Update the path to be http://localhost:80/oauth2/v2.0/token  (If your server is running on a different port, use that number instead of 80.)  Switch to the body tab and in the **code** field, type in the code.  Click the Send button.  The output response will have an access token and a refresh token (the tests tab in Postman will automatically update your two postman environment variables with the new values.)

Next, in Postman open the "Ford Get Refresh Token" call.  Right click on the tab and choose "Duplicate tab".  In the duplicate tab, rename it to "Ford Get Refresh Token Simulator".  Update the path to be http://localhost:80/oauth2/v2.0/token  (If your server is running on a different port, use that number instead of 80.)  Click the Send button.  The output response will have an access token and a refresh token (the tests tab in Postman will automatically update your two postman environment variables with the new values.)  Whenever your API token expires (every 20 minutes) you can come back here to get a new token.

Next, in Postman open the "Get Vehicle List".  Right click on the tab and choose "Duplicate tab".  Rename the duplicate tab.  Update the path to be http://localhost:80/api/fordconnect/vehicles/v1 (notice how you are just changing the domain name & leaving everything else the same.  (If your server is running on a different port, use that number instead of 80.)  You could replace it with something like {{domain}}/api/fordconnect/vehicles/v1 and then in postman set an environment variable called domain to http://localhost:80.)  You will do this for all of the remaining APIs as well.  Click the Send button.  A list of vehicles will be displayed.  Pick a vehicle that has vehicleAuthorizationIndicator set to 1 and notice what its vehicleId is.  Update the postman environment variable vehicleId with this new id.  TIP: To make it easier, you could update vehicles.js to have your simulated vehicleId match the same value as your FordConnect vehicleId.

All of the other APIs should work (you just need to change their domain to http://localhost:80)

NOTE: At some point you will want to swtich back to using the FordConnect API, you must make sure your refresh token is from either the "Ford Get Token" or "Ford Get Refresh Token" service (you can see it in the output window from your last successful call to either API).  Open the environment variables, scroll down to refreshToken and make sure your current value is correct.  Once it is correct, click the Send button on the "Ford Get Refresh Token".  Don't forget to also update your vehicleId.

|percent complete|verb|route|Postman Name|
|----------------|----|-----|------------|
90%|POST|/oauth2/v2.0/token (grant_type=authorization_code)|Ford Get Token
90%|POST|/oauth2/v2.0/token (grant_type=refresh_token)|Ford Get Refresh Token
90%|GET|api/fordconnect/vehicles/v1||Get Vehicle List
70%|POST|api/fordconnect/vehicles/v1/:vehicleId/unlock|Unlock Vehicle
70%|GET|api/fordconnect/vehicles/v1/:vehicleId/unlock/:unlockCommandId|Unlock Command Status
70%|POST|api/fordconnect/vehicles/v1/:vehicleId/lock|Lock Vehicle
70%|GET|api/fordconnect/vehicles/v1/:vehicleId/lock/:lockCommandId|Lock Command Status
70%|POST|api/fordconnect/vehicles/v1/:vehicleId/startEngine|Start Engine
70%|GET|api/fordconnect/vehicles/v1/:vehicleId/startEngine/:startCommandId|Start Command Status
70%|POST|api/fordconnect/vehicles/v1/:vehicleId/stopEngine|Stop Engine
70%|GET|api/fordconnect/vehicles/v1/:vehicleId/stopEngine/:stopCommandId|Start Command Status
80%|POST|api/fordconnect/vehicles/v1/:vehicleId/wake|Wake 
80%|GET|api/fordconnect/vehicles/v1/:vehicleId/?????/:wakeCommandId|Wake Command Status
30%|POST|api/fordconnect/vehicles/v1/:vehicleId/startCharge|Start Charge
30%|POST|api/fordconnect/vehicles/v1/:vehicleId/stopCharge|Stop Charge
<font color=#FF0>N/A</font>|GET|api/fordconnect/vehicles/v1/:vehicleId/chargeSchedules|Get charge schedule
<font color=#FF0>N/A</font>|GET|api/fordconnect/vehicles/v1/:vehicleId/departureTimes|Get departure times
90%|POST|api/fordconnect/vehicles/v1/:vehicleId/status|Vehicle Status
80%|GET|api/fordconnect/vehicles/v1/:vehicleId|Vehicle Information
70%|POST|api/fordconnect/vehicles/v1/:vehicleId/location|Vehicle Location
90%|GET|api/fordconnect/vehicles/v1/:vehicleId/location|Vehicle Location
50%|GET|api/fordconnect/vehicles/v1/:vehicleId/images/thumbnail|Get Vehicle Image Thumbnail
50%|GET|api/fordconnect/vehicles/v1/:vehicleId/images/full|Get image Full

## Exposing your simulator on the Internet
If your application cannot access your local development environment, you make need to use ngrok.com to expose it on the internet.

**TODO: Document the steps for using ngrok.com to expose the service online.**

## Known issues
The following issues will be addressed in a future update.
1. A full test pass has not happened yet, since the simulator is under development.
1. The app.js file has lots of "TEST:", "REVIEW:" and "TODO:" comments, which still need to be addressed.
1. During error paths the simulator doesn't correctly response to all APIs correctly. For example you may get a HTTP 401 instead of an HTTP 406 status code.
1. The simulator doesn't currently support changing the data (like moving vehicle, changing fuel levels, etc.)
1. The simulator doesn't currently support EV vehicles.

Please report any additional issues at the [github issues](https://github.com/jamisonderek/ford-connect-sim/issues) page.

The following issues are by design and are not planned on being updated:
1. The route for oath is "/oauth2/v2.0/token" which is different than production.
1. The messages returned by the simulator are different than production.

