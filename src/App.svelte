<script lang="ts">
  import { parse, unparse, ParseResult } from "papaparse";
  import ChooseColumns from "./ChooseColumns.svelte";
  import CreditEstimate from "./CreditEstimate.svelte";
  import Geocode from "./Geocode";

  let files: FileList;
  let columns = [];
  let csv: any[];
  let geocodeResultsCSV: string;
  let geocodeResultsCSVURL: string;

  $: newFileHandler(files);

  const newFileHandler = (fileList: FileList) => {
    if(fileList && fileList.length === 1) {
      const file = fileList[0];
      if (file) {
        var reader = new FileReader();
        reader.readAsText(file, "UTF-8");
        reader.onload = function (e: Event) {
          const text = this.result as string;
          const result: ParseResult<any> = parse(text, {
            header: true,
          });
          // console.log("result", result);
          columns = result.meta.fields;
          csv = result.data;
        };
        reader.onerror = function (evt) {
          console.error("error!", evt);
        };
      }
    }
  };

  const handleGeocode = (evt) => {
    Geocode(evt.detail, csv).then((geocodeResults: object[]) => {
      geocodeResultsCSV = unparse(geocodeResults);
      var blob = new Blob(["\ufeff", geocodeResultsCSV]);
      geocodeResultsCSVURL = URL.createObjectURL(blob);
    });
  };
</script>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }

  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }
  footer {
    text-align: center;
  }
</style>

<main>
  <h1>Geocode with ArcGIS</h1>
  <h3>Geocode using the ArcGIS World Geocoder via CSV</h3>
  <input type="file" accept="text/csv" bind:files />
  <ChooseColumns {columns} on:geocode={handleGeocode} />
  {#if csv}
    <br /><CreditEstimate rows={csv} />
  {/if}
  <br /><br />
  {#if geocodeResultsCSVURL}
    <a download="geocodeResults.csv" href={geocodeResultsCSVURL}>Download
      Results!</a>
  {/if}
</main>

<footer>
  ---<br />
  <a href="https://github.com/gavinr/geocode-with-arcgis">GitHub</a>
</footer>
