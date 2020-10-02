import { UserSession } from "@esri/arcgis-rest-auth";
import { bulkGeocode } from "@esri/arcgis-rest-geocoding";

export default function (columnInfos, data) {
  return new Promise((resolve, reject) => {
    UserSession.beginOAuth2({
      // register an app of your own to create a unique clientId
      clientId: "3pW9jYgk9S8xBkgM",
      redirectUri: "http://localhost:5000/callback.html",
      popup: true,
    }).then((authentication) => {
      let addresses = data.map((row, i) => {
        let geocodingOptions = { OBJECTID: i };
        columnInfos.forEach((columnInfo) => {
          if (columnInfo.geocodingAttribute !== "") {
            geocodingOptions[columnInfo.geocodingAttribute] =
              row[columnInfo.column];
          }
        });
        return geocodingOptions;
      });

      bulkGeocode({
        addresses,
        authentication,
      }).then(
        (response) => {
          const mergedData = Object.assign([], data);
          response.locations.forEach((locationInfo) => {
            if (locationInfo.hasOwnProperty("location")) {
              mergedData[(locationInfo.attributes as any).ResultID].x =
                locationInfo.location.x;
              mergedData[(locationInfo.attributes as any).ResultID].y =
                locationInfo.location.y;
            } else {
              mergedData[(locationInfo.attributes as any).ResultID].x = 0;
              mergedData[(locationInfo.attributes as any).ResultID].y = 0;
            }
            mergedData[(locationInfo.attributes as any).ResultID].score =
              locationInfo.score;
          });
          resolve(mergedData);
        },
        (err) => {
          reject(err);
        }
      );
    });
  });
}
