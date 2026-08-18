from rest_framework.throttling import AnonRateThrottle


class EnquiryRateThrottle(AnonRateThrottle):
    scope = 'enquiry'

    def get_rate(self):
        return self.throttle_rates.get(self.scope)
