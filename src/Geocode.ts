import { UserSession } from "@esri/arcgis-rest-auth";
import { bulkGeocode } from "@esri/arcgis-rest-geocoding";
import Swal from 'sweetalert2';

export default async function (columnInfos, data) {
  return new Promise(async (resolve, reject) => {
    const { value: accept } = await Swal.fire({
      title: 'Are you sure?',
      html: `<ol>
        <li>This operation will consume credits.</li>
        <li>The geocoded results may vary in quality.</li>
        <li>The geocoded results may be permanently lost if you close the browser or your browser crashes.</li>
      </ol>`,
      icon: 'warning',
      showCancelButton: true,
      input: 'checkbox',
      inputValue: 0,
      inputPlaceholder:
        'I have read the above and agree to the risks',
      confirmButtonText:
        'Continue<i class="fa fa-arrow-right"></i>',
      inputValidator: (result) => {
        return !result && 'Please read and agree to the risks first.'
      }
    } as any);
    // using "any" for now because https://github.com/sweetalert2/sweetalert2.github.io/pull/131
    
    if (accept) {
      UserSession.beginOAuth2({
        // register an app of your own to create a unique clientId
        clientId: "__CLIENT_ID__",
        redirectUri: "__REDIRECT_URI__",
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
    }
  });
}
