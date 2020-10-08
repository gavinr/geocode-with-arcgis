<script lang="ts">
  export let rows: any[];

  let creditsEstimate;

  $: {
    creditsEstimate = 0.04 * rows.length;
  }
</script>

Estimated credit usage: {creditsEstimate}