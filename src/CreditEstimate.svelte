<script>
  export let rows;

  let creditsEstimate;

  $: {
    creditsEstimate = 0.04 * rows.length;
  }
</script>

Estimated credit usage: {creditsEstimate}