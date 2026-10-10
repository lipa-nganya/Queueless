package tech.thewolfgang.queueless.customer

import android.app.Application
import tech.thewolfgang.queueless.customer.data.ApiClient
import tech.thewolfgang.queueless.customer.data.CustomerRepository
import tech.thewolfgang.queueless.customer.data.TokenStore

class QueuelessCustomerApp : Application() {
    lateinit var repository: CustomerRepository
        private set

    override fun onCreate() {
        super.onCreate()
        val tokenStore = TokenStore(this)
        repository = CustomerRepository(ApiClient(tokenStore, java.io.File(cacheDir, "http")), tokenStore)
    }
}
