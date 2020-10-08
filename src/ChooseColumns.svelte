<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let columns: string[];
  let columnSelects: HTMLSelectElement[] = [];

  const dispatch = createEventDispatcher();

  const geocodingAttributes = [
    "SingleLine",
    "Address",
    "City",
    "Region",
    "Postal",
    "countryCode",
  ];

  const geocodeButtonClickHandler = () => {
    const geocodingInfo = columns.map((column, i) => {
      return {
        column,
        geocodingAttribute: columnSelects[i].value,
      };
    });
    dispatch("geocode", geocodingInfo);
  };
</script>

<style>
  table {
    margin: 0 auto;
  }
</style>

{#if columns.length > 0}
  <table>
    <tr>
      {#each columns as column, index}
        <td>{column}</td>
      {/each}
    </tr>
    <tr>
      {#each columns as column, index}
        <td>
          <select bind:this={columnSelects[index]}>
            <option />
            {#each geocodingAttributes as geocodingAttribute}
              <option value={geocodingAttribute}>{geocodingAttribute}</option>
            {/each}
          </select>
        </td>
      {/each}
    </tr>
  </table>
  <button on:click={geocodeButtonClickHandler}>Geocode</button>
{/if}
