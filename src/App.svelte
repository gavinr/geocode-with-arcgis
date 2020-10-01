<script lang="ts">
  import Papa from "papaparse";
  import ChooseColumns from "./ChooseColumns.svelte";
  let fileInput;
  let columns = [];

  const submitFormHandler = (evt: Event) => {
    evt.preventDefault();
    const file = fileInput.files[0];
    if (file) {
      var reader = new FileReader();
      reader.readAsText(file, "UTF-8");
      reader.onload = function (evt) {
        const result = Papa.parse(evt.target.result);
        console.log("result", result);
        columns = result.data[0];
      };
      reader.onerror = function (evt) {
        console.error("error!", evt);
      };
    }
  };

  const handleGeocode = (evt) => {
    console.log("handleGeocode", evt);
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
  <form on:submit={submitFormHandler}>
    <input type="file" accept="text/csv" bind:this={fileInput} />
    <input type="submit" value="Upload" />
  </form>
  <ChooseColumns {columns} on:geocode={handleGeocode} />
</main>
