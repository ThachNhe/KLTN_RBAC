interface Rule {
  RuleId: string
  Effect: string
  Role: string
  Action: string
  Resource: string
  Name: string
  Condition?: {
    Restriction: string[]
  }
}

export interface Module {
  Name: string
  Controller1: {
    Rule: Rule[]
  }
}
