from rest_framework.throttling import UserRateThrottle


class GenerateProposalRateThrottle(UserRateThrottle):
    scope = "generate_proposal"


class GenerateTemplateRateThrottle(UserRateThrottle):
    scope = "generate_template"


class GenerateAIActionRateThrottle(UserRateThrottle):
    scope = "generate_ai_action"
