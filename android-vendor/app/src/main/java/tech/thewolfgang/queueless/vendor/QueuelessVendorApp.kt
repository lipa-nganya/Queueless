package tech.thewolfgang.queueless.vendor

import android.app.Application
import tech.thewolfgang.queueless.vendor.data.ApiClient
import tech.thewolfgang.queueless.vendor.data.TokenStore
import tech.thewolfgang.queueless.vendor.data.VendorRepository

class QueuelessVendorApp : Application() {
    lateinit var tokenStore: TokenStore
        private set
    lateinit var repository: VendorRepository
        private set

    override fun onCreate() {
        super.onCreate()
        tokenStore = TokenStore(this)
        repository = VendorRepository(ApiClient(tokenStore), tokenStore)
    }
}
