<template>
  <div />
</template>

<script lang="ts">
import { defineComponent } from '@nuxtjs/composition-api'
import axios from '~/lib/axios'

export default defineComponent({
  setup () {
    if (process.client) {
      axios
        .get('/')
        .then((res) => {
          // 初回リクエストとリトライリクエストのいずれかで200が返ればこちら
          console.log(`res: ${JSON.stringify(res)}`)
        })
        .catch((err) => {
          // いずれのリクエストでも200が返らなければこちら
          console.log(`err: ${JSON.stringify(err)}`)
        })
    }
    return {}
  }
})
</script>
