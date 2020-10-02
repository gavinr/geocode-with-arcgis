<script lang="ts">
  import { onMount } from "svelte";

  import { parse, unparse, ParseResult } from "papaparse";
  import ChooseColumns from "./ChooseColumns.svelte";
  import Geocode from "./Geocode";

  let fileInput;
  let columns = [];
  let csv: [];
  let geocodeResultsCSV: string;
  let geocodeResultsCSVURL: string;

  const submitFormHandler = (evt: Event) => {
    evt.preventDefault();
    const file = fileInput.files[0];
    if (file) {
      var reader = new FileReader();
      reader.readAsText(file, "UTF-8");
      reader.onload = function (e: Event) {
        console.log("result:", this.result);
        const text = this.result as string;
        const result: ParseResult<any> = parse(text, {
          header: true,
        });
        console.log("result", result);
        columns = result.meta.fields;
        csv = result.data;
      };
      reader.onerror = function (evt) {
        console.error("error!", evt);
      };
    }
  };

  const handleGeocode = (evt) => {
    console.log("handleGeocode", evt.detail);
    Geocode(evt.detail, csv).then((geocodeResults: object[]) => {
      console.log("geocodeResults!", geocodeResults);
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
</style>

<main>
  <h1>Geocode with ArcGIS *ALPHA*</h1>
  <h2>Upload CSV > Download Results as CSV</h2>
  <h2>*ALPHA SOFTWARE - DO NOT USE THIS UNLESS YOU KNOW WHAT YOU'RE DOING*</h2>
  <form on:submit={submitFormHandler}>
    <input type="file" accept="text/csv" bind:this={fileInput} />
    <input type="submit" value="Upload" />
  </form>
  <ChooseColumns {columns} on:geocode={handleGeocode} />
  {#if geocodeResultsCSVURL}
    <a download="geocodeResults.csv" href={geocodeResultsCSVURL}>Download
      Results!</a>
  {/if}
</main>
