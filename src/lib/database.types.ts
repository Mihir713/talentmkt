
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "accounts": {
                  Row: {
                    "balance": number,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "balance"?: number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "balance"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "accounts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"app_settings": {
                  Row: {
                    "key": string,"updated_at": string,"value": NonNullable<Json>
                  }
                  Insert: {
                    "key": string,"updated_at"?: string,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor": string | null,"actor_role": string,"app_time": string,"created_at": string,"entity": string,"entity_id": string | null,"id": number,"payload": NonNullable<Json>
                  }
                  Insert: {
                    "action": string,"actor"?: string | null,"actor_role": string,"app_time"?: string,"created_at"?: string,"entity": string,"entity_id"?: string | null,"id"?: never,"payload"?: NonNullable<Json>
                  }
                  Update: {
                    "action"?: string,"actor"?: string | null,"actor_role"?: string,"app_time"?: string,"created_at"?: string,"entity"?: string,"entity_id"?: string | null,"id"?: never,"payload"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"cohort_memberships": {
                  Row: {
                    "cohort_id": number,"computed_at": string,"user_id": string
                  }
                  Insert: {
                    "cohort_id": number,"computed_at"?: string,"user_id": string
                  }
                  Update: {
                    "cohort_id"?: number,"computed_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cohort_memberships_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "cohorts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cohort_memberships_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "v_cohort_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cohort_memberships_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "v_market_cards"
      referencedColumns: ["cohort_id"]
    },{
      foreignKeyName: "cohort_memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"cohort_snapshots": {
                  Row: {
                    "cohort_id": number,"frozen_at": string,"id": number,"member_count": number
                  }
                  Insert: {
                    "cohort_id": number,"frozen_at"?: string,"id"?: never,"member_count": number
                  }
                  Update: {
                    "cohort_id"?: number,"frozen_at"?: string,"id"?: never,"member_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "cohort_snapshots_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "cohorts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cohort_snapshots_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "v_cohort_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cohort_snapshots_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "v_market_cards"
      referencedColumns: ["cohort_id"]
    }
                  ]
                },"cohorts": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"created_at": string,"definition": NonNullable<Json>,"id": number,"min_size": number,"model": string | null,"prompt_version": string | null,"proposed_by": Database["public"]['Enums']["proposer"],"rationale": string | null,"slug": string,"status": Database["public"]['Enums']["cohort_status"],"title": string
                  }
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"definition": NonNullable<Json>,"id"?: never,"min_size"?: number,"model"?: string | null,"prompt_version"?: string | null,"proposed_by": Database["public"]['Enums']["proposer"],"rationale"?: string | null,"slug": string,"status"?: Database["public"]['Enums']["cohort_status"],"title": string
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"definition"?: NonNullable<Json>,"id"?: never,"min_size"?: number,"model"?: string | null,"prompt_version"?: string | null,"proposed_by"?: Database["public"]['Enums']["proposer"],"rationale"?: string | null,"slug"?: string,"status"?: Database["public"]['Enums']["cohort_status"],"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cohorts_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"course_skill_tags": {
                  Row: {
                    "course_id": number,"skill_tag_id": number,"weight": number
                  }
                  Insert: {
                    "course_id": number,"skill_tag_id": number,"weight": number
                  }
                  Update: {
                    "course_id"?: number,"skill_tag_id"?: number,"weight"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "course_skill_tags_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "course_skill_tags_skill_tag_id_fkey"
      columns: ["skill_tag_id"]
isOneToOne: false
      referencedRelation: "mv_skill_signal"
      referencedColumns: ["skill_tag_id"]
    },{
      foreignKeyName: "course_skill_tags_skill_tag_id_fkey"
      columns: ["skill_tag_id"]
isOneToOne: false
      referencedRelation: "skill_tags"
      referencedColumns: ["id"]
    }
                  ]
                },"courses": {
                  Row: {
                    "code": string,"id": number,"level": number,"title": string,"university_id": number
                  }
                  Insert: {
                    "code": string,"id"?: never,"level": number,"title": string,"university_id": number
                  }
                  Update: {
                    "code"?: string,"id"?: never,"level"?: number,"title"?: string,"university_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "courses_university_id_fkey"
      columns: ["university_id"]
isOneToOne: false
      referencedRelation: "universities"
      referencedColumns: ["id"]
    }
                  ]
                },"job_regions": {
                  Row: {
                    "code": string,"country": string,"label": string,"phrase": string
                  }
                  Insert: {
                    "code": string,"country": string,"label": string,"phrase": string
                  }
                  Update: {
                    "code"?: string,"country"?: string,"label"?: string,"phrase"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ledger_entries": {
                  Row: {
                    "amount": number,"created_at": string,"id": number,"kind": Database["public"]['Enums']["ledger_kind"],"market_id": number | null,"memo": string | null,"trade_id": number | null,"user_id": string
                  }
                  Insert: {
                    "amount": number,"created_at"?: string,"id"?: never,"kind": Database["public"]['Enums']["ledger_kind"],"market_id"?: number | null,"memo"?: string | null,"trade_id"?: number | null,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"id"?: never,"kind"?: Database["public"]['Enums']["ledger_kind"],"market_id"?: number | null,"memo"?: string | null,"trade_id"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ledger_entries_market_id_fkey"
      columns: ["market_id"]
isOneToOne: false
      referencedRelation: "markets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ledger_entries_market_id_fkey"
      columns: ["market_id"]
isOneToOne: false
      referencedRelation: "v_market_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ledger_entries_trade_id_fkey"
      columns: ["trade_id"]
isOneToOne: false
      referencedRelation: "trades"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ledger_entries_trade_id_fkey"
      columns: ["trade_id"]
isOneToOne: false
      referencedRelation: "v_public_trades"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ledger_entries_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["user_id"]
    }
                  ]
                },"market_proposals": {
                  Row: {
                    "cohort_id": number,"created_at": string,"id": number,"model": string | null,"params": NonNullable<Json>,"prompt_version": string | null,"proposed_by": Database["public"]['Enums']["proposer"],"rationale": string,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["proposal_status"],"template_id": number
                  }
                  Insert: {
                    "cohort_id": number,"created_at"?: string,"id"?: never,"model"?: string | null,"params": NonNullable<Json>,"prompt_version"?: string | null,"proposed_by": Database["public"]['Enums']["proposer"],"rationale": string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["proposal_status"],"template_id": number
                  }
                  Update: {
                    "cohort_id"?: number,"created_at"?: string,"id"?: never,"model"?: string | null,"params"?: NonNullable<Json>,"prompt_version"?: string | null,"proposed_by"?: Database["public"]['Enums']["proposer"],"rationale"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["proposal_status"],"template_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "market_proposals_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "cohorts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "market_proposals_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "v_cohort_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "market_proposals_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "v_market_cards"
      referencedColumns: ["cohort_id"]
    },{
      foreignKeyName: "market_proposals_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "market_proposals_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "market_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"market_resolutions": {
                  Row: {
                    "denominator": number | null,"market_id": number,"method": string,"note": string | null,"numerator": number | null,"resolved_at": string,"resolved_by": string | null,"response_rate": number | null
                  }
                  Insert: {
                    "denominator"?: number | null,"market_id": number,"method": string,"note"?: string | null,"numerator"?: number | null,"resolved_at"?: string,"resolved_by"?: string | null,"response_rate"?: number | null
                  }
                  Update: {
                    "denominator"?: number | null,"market_id"?: number,"method"?: string,"note"?: string | null,"numerator"?: number | null,"resolved_at"?: string,"resolved_by"?: string | null,"response_rate"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "market_resolutions_market_id_fkey"
      columns: ["market_id"]
isOneToOne: true
      referencedRelation: "markets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "market_resolutions_market_id_fkey"
      columns: ["market_id"]
isOneToOne: true
      referencedRelation: "v_market_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "market_resolutions_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"market_templates": {
                  Row: {
                    "id": number,"metric": Database["public"]['Enums']["market_metric"],"param_schema": NonNullable<Json>,"question_pattern": string,"rule_pattern": string
                  }
                  Insert: {
                    "id"?: never,"metric": Database["public"]['Enums']["market_metric"],"param_schema": NonNullable<Json>,"question_pattern": string,"rule_pattern": string
                  }
                  Update: {
                    "id"?: never,"metric"?: Database["public"]['Enums']["market_metric"],"param_schema"?: NonNullable<Json>,"question_pattern"?: string,"rule_pattern"?: string
                  }
                  Relationships: [
                    
                  ]
                },"markets": {
                  Row: {
                    "b": number,"closes_at": string,"created_at": string,"fee_bps": number,"id": number,"nonresponse_rule": Database["public"]['Enums']["nonresponse_rule"],"opens_at": string,"outcome": Database["public"]['Enums']["trade_side"] | null,"params": NonNullable<Json>,"proposal_id": number | null,"q_no": number,"q_yes": number,"question": string,"quorum_pct": number | null,"resolution_rule": string,"resolves_at": string,"snapshot_id": number,"status": Database["public"]['Enums']["market_status"],"template_id": number
                  }
                  Insert: {
                    "b"?: number,"closes_at": string,"created_at"?: string,"fee_bps"?: number,"id"?: never,"nonresponse_rule"?: Database["public"]['Enums']["nonresponse_rule"],"opens_at"?: string,"outcome"?: Database["public"]['Enums']["trade_side"] | null,"params": NonNullable<Json>,"proposal_id"?: number | null,"q_no"?: number,"q_yes"?: number,"question": string,"quorum_pct"?: number | null,"resolution_rule": string,"resolves_at": string,"snapshot_id": number,"status"?: Database["public"]['Enums']["market_status"],"template_id": number
                  }
                  Update: {
                    "b"?: number,"closes_at"?: string,"created_at"?: string,"fee_bps"?: number,"id"?: never,"nonresponse_rule"?: Database["public"]['Enums']["nonresponse_rule"],"opens_at"?: string,"outcome"?: Database["public"]['Enums']["trade_side"] | null,"params"?: NonNullable<Json>,"proposal_id"?: number | null,"q_no"?: number,"q_yes"?: number,"question"?: string,"quorum_pct"?: number | null,"resolution_rule"?: string,"resolves_at"?: string,"snapshot_id"?: number,"status"?: Database["public"]['Enums']["market_status"],"template_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "markets_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: true
      referencedRelation: "market_proposals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "markets_snapshot_id_fkey"
      columns: ["snapshot_id"]
isOneToOne: false
      referencedRelation: "cohort_snapshots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "markets_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "market_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"outcome_reports": {
                  Row: {
                    "field_skill_tag_id": number | null,"id": string,"region": string | null,"reported_at": string,"salary_band": Database["public"]['Enums']["salary_band"] | null,"status": Database["public"]['Enums']["outcome_status"],"synthetic": boolean,"user_id": string,"verification": Database["public"]['Enums']["verification_level"]
                  }
                  Insert: {
                    "field_skill_tag_id"?: number | null,"id"?: string,"region"?: string | null,"reported_at"?: string,"salary_band"?: Database["public"]['Enums']["salary_band"] | null,"status": Database["public"]['Enums']["outcome_status"],"synthetic"?: boolean,"user_id": string,"verification"?: Database["public"]['Enums']["verification_level"]
                  }
                  Update: {
                    "field_skill_tag_id"?: number | null,"id"?: string,"region"?: string | null,"reported_at"?: string,"salary_band"?: Database["public"]['Enums']["salary_band"] | null,"status"?: Database["public"]['Enums']["outcome_status"],"synthetic"?: boolean,"user_id"?: string,"verification"?: Database["public"]['Enums']["verification_level"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "outcome_reports_field_skill_tag_id_fkey"
      columns: ["field_skill_tag_id"]
isOneToOne: false
      referencedRelation: "mv_skill_signal"
      referencedColumns: ["skill_tag_id"]
    },{
      foreignKeyName: "outcome_reports_field_skill_tag_id_fkey"
      columns: ["field_skill_tag_id"]
isOneToOne: false
      referencedRelation: "skill_tags"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outcome_reports_region_fkey"
      columns: ["region"]
isOneToOne: false
      referencedRelation: "job_regions"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "outcome_reports_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"positions": {
                  Row: {
                    "market_id": number,"no_cost_basis": number,"no_shares": number,"realized_pnl": number,"settled_at": string | null,"updated_at": string,"user_id": string,"yes_cost_basis": number,"yes_shares": number
                  }
                  Insert: {
                    "market_id": number,"no_cost_basis"?: number,"no_shares"?: number,"realized_pnl"?: number,"settled_at"?: string | null,"updated_at"?: string,"user_id": string,"yes_cost_basis"?: number,"yes_shares"?: number
                  }
                  Update: {
                    "market_id"?: number,"no_cost_basis"?: number,"no_shares"?: number,"realized_pnl"?: number,"settled_at"?: string | null,"updated_at"?: string,"user_id"?: string,"yes_cost_basis"?: number,"yes_shares"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "positions_market_id_fkey"
      columns: ["market_id"]
isOneToOne: false
      referencedRelation: "markets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "positions_market_id_fkey"
      columns: ["market_id"]
isOneToOne: false
      referencedRelation: "v_market_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "positions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"price_points": {
                  Row: {
                    "id": number,"market_id": number,"p_yes": number,"trade_id": number | null,"ts": string
                  }
                  Insert: {
                    "id"?: never,"market_id": number,"p_yes": number,"trade_id"?: number | null,"ts"?: string
                  }
                  Update: {
                    "id"?: never,"market_id"?: number,"p_yes"?: number,"trade_id"?: number | null,"ts"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "price_points_market_id_fkey"
      columns: ["market_id"]
isOneToOne: false
      referencedRelation: "markets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "price_points_market_id_fkey"
      columns: ["market_id"]
isOneToOne: false
      referencedRelation: "v_market_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "price_points_trade_id_fkey"
      columns: ["trade_id"]
isOneToOne: true
      referencedRelation: "trades"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "price_points_trade_id_fkey"
      columns: ["trade_id"]
isOneToOne: true
      referencedRelation: "v_public_trades"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"handle": string,"role": Database["public"]['Enums']["user_role"],"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"handle": string,"role"?: Database["public"]['Enums']["user_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"handle"?: string,"role"?: Database["public"]['Enums']["user_role"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"programs": {
                  Row: {
                    "faculty": string,"id": number,"name": string,"university_id": number
                  }
                  Insert: {
                    "faculty": string,"id"?: never,"name": string,"university_id": number
                  }
                  Update: {
                    "faculty"?: string,"id"?: never,"name"?: string,"university_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "programs_university_id_fkey"
      columns: ["university_id"]
isOneToOne: false
      referencedRelation: "universities"
      referencedColumns: ["id"]
    }
                  ]
                },"skill_tags": {
                  Row: {
                    "category": string,"id": number,"label": string,"slug": string
                  }
                  Insert: {
                    "category": string,"id"?: never,"label": string,"slug": string
                  }
                  Update: {
                    "category"?: string,"id"?: never,"label"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"snapshot_members": {
                  Row: {
                    "member_no": number,"snapshot_id": number,"user_id": string | null
                  }
                  Insert: {
                    "member_no": number,"snapshot_id": number,"user_id"?: string | null
                  }
                  Update: {
                    "member_no"?: number,"snapshot_id"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "snapshot_members_snapshot_id_fkey"
      columns: ["snapshot_id"]
isOneToOne: false
      referencedRelation: "cohort_snapshots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "snapshot_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"student_profiles": {
                  Row: {
                    "consent_at": string,"created_at": string,"grad_year": number | null,"program_id": number | null,"university_id": number,"user_id": string,"verified_email_at": string
                  }
                  Insert: {
                    "consent_at": string,"created_at"?: string,"grad_year"?: number | null,"program_id"?: number | null,"university_id": number,"user_id": string,"verified_email_at": string
                  }
                  Update: {
                    "consent_at"?: string,"created_at"?: string,"grad_year"?: number | null,"program_id"?: number | null,"university_id"?: number,"user_id"?: string,"verified_email_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_profiles_program_id_university_id_fkey"
      columns: ["program_id","university_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id","university_id"]
    },{
      foreignKeyName: "student_profiles_university_id_fkey"
      columns: ["university_id"]
isOneToOne: false
      referencedRelation: "universities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_profiles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"trades": {
                  Row: {
                    "action": Database["public"]['Enums']["trade_action"],"cost": number,"created_at": string,"fee": number,"id": number,"market_id": number,"price_after": number,"price_before": number,"shares": number,"side": Database["public"]['Enums']["trade_side"],"user_id": string
                  }
                  Insert: {
                    "action": Database["public"]['Enums']["trade_action"],"cost": number,"created_at"?: string,"fee": number,"id"?: never,"market_id": number,"price_after": number,"price_before": number,"shares": number,"side": Database["public"]['Enums']["trade_side"],"user_id": string
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["trade_action"],"cost"?: number,"created_at"?: string,"fee"?: number,"id"?: never,"market_id"?: number,"price_after"?: number,"price_before"?: number,"shares"?: number,"side"?: Database["public"]['Enums']["trade_side"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trades_market_id_fkey"
      columns: ["market_id"]
isOneToOne: false
      referencedRelation: "markets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trades_market_id_fkey"
      columns: ["market_id"]
isOneToOne: false
      referencedRelation: "v_market_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trades_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"transcript_courses": {
                  Row: {
                    "course_id": number,"grade_band": Database["public"]['Enums']["grade_band"] | null,"term": string,"user_id": string
                  }
                  Insert: {
                    "course_id": number,"grade_band"?: Database["public"]['Enums']["grade_band"] | null,"term": string,"user_id": string
                  }
                  Update: {
                    "course_id"?: number,"grade_band"?: Database["public"]['Enums']["grade_band"] | null,"term"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transcript_courses_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transcript_courses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"transcript_uploads": {
                  Row: {
                    "confirmed_at": string | null,"created_at": string,"error": string | null,"file_deleted_at": string | null,"id": string,"model": string | null,"parsed_json": Json | null,"prompt_version": string | null,"status": Database["public"]['Enums']["upload_status"],"storage_path": string,"user_id": string
                  }
                  Insert: {
                    "confirmed_at"?: string | null,"created_at"?: string,"error"?: string | null,"file_deleted_at"?: string | null,"id"?: string,"model"?: string | null,"parsed_json"?: Json | null,"prompt_version"?: string | null,"status"?: Database["public"]['Enums']["upload_status"],"storage_path": string,"user_id": string
                  }
                  Update: {
                    "confirmed_at"?: string | null,"created_at"?: string,"error"?: string | null,"file_deleted_at"?: string | null,"id"?: string,"model"?: string | null,"parsed_json"?: Json | null,"prompt_version"?: string | null,"status"?: Database["public"]['Enums']["upload_status"],"storage_path"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transcript_uploads_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"universities": {
                  Row: {
                    "email_domain": string,"id": number,"name": string,"region": string,"short_name": string
                  }
                  Insert: {
                    "email_domain": string,"id"?: never,"name": string,"region": string,"short_name": string
                  }
                  Update: {
                    "email_domain"?: string,"id"?: never,"name"?: string,"region"?: string,"short_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"watchlist": {
                  Row: {
                    "created_at": string,"market_id": number,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"market_id": number,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"market_id"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "watchlist_market_id_fkey"
      columns: ["market_id"]
isOneToOne: false
      referencedRelation: "markets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "watchlist_market_id_fkey"
      columns: ["market_id"]
isOneToOne: false
      referencedRelation: "v_market_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "watchlist_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                }
          }
          Views: {
            "mv_skill_signal": {
                  Row: {
                    "category": string | null,"change_7d": number | null,"computed_at": string | null,"label": string | null,"open_markets": number | null,"signal": number | null,"signal_7d_ago": number | null,"skill_tag_id": number | null,"slug": string | null,"volume": number | null
                  }
                  Relationships: [
                    
                  ]
                },"v_cohort_public": {
                  Row: {
                    "created_at": string | null,"definition": Json | null,"id": number | null,"member_count_rounded": number | null,"open_markets": number | null,"slug": string | null,"status": Database["public"]['Enums']["cohort_status"] | null,"title": string | null,"top_skills": Json | null,"total_markets": number | null
                  }
                  Relationships: [
                    
                  ]
                },"v_leaderboard": {
                  Row: {
                    "accuracy_rank": number | null,"brier": number | null,"handle": string | null,"is_me": boolean | null,"pnl": number | null,"pnl_rank": number | null,"realized_pnl": number | null,"resolved_markets": number | null
                  }
                  Relationships: [
                    
                  ]
                },"v_market_cards": {
                  Row: {
                    "b": number | null,"change_24h": number | null,"closes_at": string | null,"closes_in_seconds": number | null,"cohort_id": number | null,"cohort_slug": string | null,"cohort_title": string | null,"created_at": string | null,"fee_bps": number | null,"id": number | null,"metric": Database["public"]['Enums']["market_metric"] | null,"nonresponse_rule": Database["public"]['Enums']["nonresponse_rule"] | null,"opens_at": string | null,"outcome": Database["public"]['Enums']["trade_side"] | null,"p_yes": number | null,"params": Json | null,"q_no": number | null,"q_yes": number | null,"question": string | null,"quorum_pct": number | null,"resolution_rule": string | null,"resolved_at": string | null,"resolved_pct_rounded": number | null,"resolves_at": string | null,"skill_slugs": (string)[] | null,"snapshot_size_rounded": number | null,"status": Database["public"]['Enums']["market_status"] | null,"trade_count": number | null,"traders": number | null,"volume_24h": number | null,"volume_total": number | null
                  }
                  Relationships: [
                    
                  ]
                },"v_portfolio": {
                  Row: {
                    "b": number | null,"closes_at": string | null,"cohort_slug": string | null,"cohort_title": string | null,"cost_basis": number | null,"fee_bps": number | null,"mark_value": number | null,"market_id": number | null,"no_shares": number | null,"outcome": Database["public"]['Enums']["trade_side"] | null,"p_yes": number | null,"q_no": number | null,"q_yes": number | null,"question": string | null,"realized_pnl": number | null,"settled_at": string | null,"status": Database["public"]['Enums']["market_status"] | null,"unrealized_pnl": number | null,"updated_at": string | null,"yes_shares": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "positions_market_id_fkey"
      columns: ["market_id"]
isOneToOne: false
      referencedRelation: "markets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "positions_market_id_fkey"
      columns: ["market_id"]
isOneToOne: false
      referencedRelation: "v_market_cards"
      referencedColumns: ["id"]
    }
                  ]
                },"v_price_candles": {
                  Row: {
                    "bucket": string | null,"close": number | null,"high": number | null,"low": number | null,"market_id": number | null,"open": number | null,"trades": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "price_points_market_id_fkey"
      columns: ["market_id"]
isOneToOne: false
      referencedRelation: "markets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "price_points_market_id_fkey"
      columns: ["market_id"]
isOneToOne: false
      referencedRelation: "v_market_cards"
      referencedColumns: ["id"]
    }
                  ]
                },"v_public_trades": {
                  Row: {
                    "action": Database["public"]['Enums']["trade_action"] | null,"cost": number | null,"created_at": string | null,"fee": number | null,"id": number | null,"market_id": number | null,"price_after": number | null,"price_before": number | null,"shares": number | null,"side": Database["public"]['Enums']["trade_side"] | null
                  }
                  Insert: {
                           "action"?: Database["public"]['Enums']["trade_action"] | null,"cost"?: number | null,"created_at"?: string | null,"fee"?: number | null,"id"?: number | null,"market_id"?: number | null,"price_after"?: number | null,"price_before"?: number | null,"shares"?: number | null,"side"?: Database["public"]['Enums']["trade_side"] | null
                         }
                        Update: {
                           "action"?: Database["public"]['Enums']["trade_action"] | null,"cost"?: number | null,"created_at"?: string | null,"fee"?: number | null,"id"?: number | null,"market_id"?: number | null,"price_after"?: number | null,"price_before"?: number | null,"shares"?: number | null,"side"?: Database["public"]['Enums']["trade_side"] | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "trades_market_id_fkey"
      columns: ["market_id"]
isOneToOne: false
      referencedRelation: "markets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trades_market_id_fkey"
      columns: ["market_id"]
isOneToOne: false
      referencedRelation: "v_market_cards"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_cohort_overview":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"definition": Json,"id": number,"member_count": number,"min_size": number,"model": string,"open_markets": number,"proposed_by": Database["public"]['Enums']["proposer"],"rationale": string,"slug": string,"status": Database["public"]['Enums']["cohort_status"],"title": string
            }[]
                           },
"admin_generate_outcomes":
{ Args: { "p_market_id": number,"p_response_rate"?: number,"p_true_rate": number }; Returns: Json
                           },
"admin_refresh_skill_signal":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"admin_resolve_due_markets":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_review_cohort":
{ Args: { "p_approve": boolean,"p_cohort_id": number }; Returns: Json
                           },
"admin_review_market_proposal":
{ Args: { "p_approve": boolean,"p_b"?: number,"p_nonresponse_rule"?: Database["public"]['Enums']["nonresponse_rule"],"p_proposal_id": number,"p_quorum_pct"?: number }; Returns: Json
                           },
"admin_set_sim_now":
{ Args: { "p_ts": string }; Returns: string
                           },
"admin_skill_cooccurrence":
{ Args: { "p_min_weighted"?: number }; Returns: Json
                           },
"app_now":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"begin_transcript_upload":
{ Args: { "p_storage_path": string }; Returns: string
                           },
"can_trade":
{ Args: { "p_market_id": number }; Returns: Json
                           },
"compute_memberships":
{ Args: { "p_cohort_id": number }; Returns: number
                           },
"confirm_transcript":
{ Args: { "p_courses": Json,"p_grad_year": number,"p_program_id": number,"p_upload_id": string }; Returns: Json
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"delete_my_data":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"execute_trade":
{ Args: { "p_action": Database["public"]['Enums']["trade_action"],"p_market_id": number,"p_max_cost"?: number,"p_min_return"?: number,"p_shares": number,"p_side": Database["public"]['Enums']["trade_side"] }; Returns: Json
                           },
"freeze_snapshot":
{ Args: { "p_cohort_id": number }; Returns: number
                           },
"give_student_consent":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"landing_stats":
{ Args: Record<PropertyKey, never>; Returns: {
              "live_cohorts": number,"open_markets": number,"students": number,"traders": number,"trades": number
            }[]
                           },
"lmsr_cost":
{ Args: { "p_b": number,"p_q_no": number,"p_q_yes": number }; Returns: number
                           },
"lmsr_price":
{ Args: { "p_b": number,"p_q_no": number,"p_q_yes": number }; Returns: number
                           },
"lmsr_shares_for_cost":
{ Args: { "p_b": number,"p_cost": number,"p_q_other": number,"p_q_side": number }; Returns: number
                           },
"mark_transcript_file_deleted":
{ Args: { "p_upload_id": string }; Returns: undefined
                           },
"market_sparklines":
{ Args: { "p_days"?: number,"p_market_ids": (number)[],"p_points"?: number }; Returns: {
              "market_id": number,"points": (number)[]
            }[]
                           },
"my_skill_profile":
{ Args: Record<PropertyKey, never>; Returns: {
              "category": string,"courses": number,"label": string,"slug": string,"weighted": number
            }[]
                           },
"propose_cohort":
{ Args: { "p_definition": Json,"p_model"?: string,"p_prompt_version"?: string,"p_rationale"?: string,"p_slug": string,"p_title": string }; Returns: number
                           },
"propose_market":
{ Args: { "p_cohort_id": number,"p_metric": Database["public"]['Enums']["market_metric"],"p_model"?: string,"p_params": Json,"p_prompt_version"?: string,"p_rationale": string }; Returns: number
                           },
"quote_trade":
{ Args: { "p_action": Database["public"]['Enums']["trade_action"],"p_market_id": number,"p_shares"?: number,"p_side": Database["public"]['Enums']["trade_side"],"p_spend"?: number }; Returns: {
              "avg_price": number,"cost": number,"fee": number,"max_payout": number,"price_after": number,"price_before": number,"shares": number,"total": number
            }[]
                           },
"record_transcript_parse":
{ Args: { "p_error"?: string,"p_model"?: string,"p_parsed_json"?: Json,"p_prompt_version"?: string,"p_status": Database["public"]['Enums']["upload_status"],"p_upload_id": string }; Returns: undefined
                           },
"resolve_market":
{ Args: { "p_market_id": number }; Returns: Json
                           },
"search_catalog":
{ Args: { "p_limit"?: number,"p_query": string }; Returns: {
              "key": string,"kind": string,"score": number,"subtitle": string,"title": string
            }[]
                           },
"search_courses":
{ Args: { "p_limit"?: number,"p_query": string,"p_university_id": number }; Returns: {
              "code": string,"id": number,"level": number,"title": string
            }[]
                           },
"submit_outcome_report":
{ Args: { "p_field"?: string,"p_region"?: string,"p_salary_band"?: Database["public"]['Enums']["salary_band"],"p_status": Database["public"]['Enums']["outcome_status"] }; Returns: string
                           },
"toggle_watchlist":
{ Args: { "p_market_id": number }; Returns: boolean
                           },
"void_market":
{ Args: { "p_market_id": number,"p_reason"?: string }; Returns: Json
                           }
          }
          Enums: {
            "cohort_status": "proposed"|"active"|"retired","grade_band": "A"|"B"|"C"|"D"|"F"|"P"|"IP","ledger_kind": "signup_grant"|"trade"|"fee"|"payout"|"refund"|"admin_adjust","market_metric": "employed_in_field"|"employed_in_region"|"salary_at_least"|"grad_school","market_status": "open"|"closed"|"resolved"|"voided","nonresponse_rule": "count_as_no"|"exclude_with_quorum","outcome_status": "employed"|"searching"|"grad_school"|"other","proposal_status": "pending"|"approved"|"rejected","proposer": "ai"|"admin","salary_band": "under_50k"|"50k_75k"|"75k_100k"|"100k_125k"|"125k_150k"|"150k_200k"|"200k_plus","trade_action": "buy"|"sell","trade_side": "yes"|"no","upload_status": "uploaded"|"parsing"|"needs_review"|"confirmed"|"failed","user_role": "trader"|"student"|"admin","verification_level": "self"|"verified"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "cohort_status": ["proposed", "active", "retired"],"grade_band": ["A", "B", "C", "D", "F", "P", "IP"],"ledger_kind": ["signup_grant", "trade", "fee", "payout", "refund", "admin_adjust"],"market_metric": ["employed_in_field", "employed_in_region", "salary_at_least", "grad_school"],"market_status": ["open", "closed", "resolved", "voided"],"nonresponse_rule": ["count_as_no", "exclude_with_quorum"],"outcome_status": ["employed", "searching", "grad_school", "other"],"proposal_status": ["pending", "approved", "rejected"],"proposer": ["ai", "admin"],"salary_band": ["under_50k", "50k_75k", "75k_100k", "100k_125k", "125k_150k", "150k_200k", "200k_plus"],"trade_action": ["buy", "sell"],"trade_side": ["yes", "no"],"upload_status": ["uploaded", "parsing", "needs_review", "confirmed", "failed"],"user_role": ["trader", "student", "admin"],"verification_level": ["self", "verified"]
          }
        }
} as const
