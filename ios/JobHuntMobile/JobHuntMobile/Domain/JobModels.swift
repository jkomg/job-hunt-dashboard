import Foundation

struct JobDraft: Codable, Equatable, Identifiable {
    let id: UUID
    var company: String
    var role: String
    var url: String
    var location: String
    var skills: [String]
    var notes: String
    var sourceText: String
    var needsReview: Bool

    init(
        id: UUID = UUID(), company: String = "", role: String = "", url: String = "",
        location: String = "", skills: [String] = [], notes: String = "",
        sourceText: String = "", needsReview: Bool = true
    ) {
        self.id = id
        self.company = company
        self.role = role
        self.url = url
        self.location = location
        self.skills = skills
        self.notes = notes
        self.sourceText = sourceText
        self.needsReview = needsReview
    }
}

struct TodayQueueItem: Decodable, Equatable, Identifiable {
    enum Kind: String, Codable { case followUp, interview, application, networking }

    let id: String
    let title: String
    let subtitle: String
    let dueLabel: String
    let kind: Kind
    let isOverdue: Bool

    init(id: String, title: String, subtitle: String, dueLabel: String, kind: Kind, isOverdue: Bool) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.dueLabel = dueLabel
        self.kind = kind
        self.isOverdue = isOverdue
    }

    private enum CodingKeys: String, CodingKey { case id, entityId, title, subtitle, reason, actionLabel, type, dueDate }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decodeIfPresent(String.self, forKey: .id)
            ?? values.decodeIfPresent(String.self, forKey: .entityId)
            ?? UUID().uuidString
        title = try values.decodeIfPresent(String.self, forKey: .title) ?? "Next action"
        subtitle = try values.decodeIfPresent(String.self, forKey: .subtitle)
            ?? values.decodeIfPresent(String.self, forKey: .reason) ?? ""
        let type = try values.decodeIfPresent(String.self, forKey: .type) ?? "application"
        if type.contains("interview") { kind = .interview }
        else if type.contains("contact") || type.contains("network") { kind = .networking }
        else if type.contains("follow") { kind = .followUp }
        else { kind = .application }
        if let date = try values.decodeIfPresent(String.self, forKey: .dueDate) {
            dueLabel = date == String(Date().formatted(.iso8601.year().month().day())) ? "Due today" : date
            isOverdue = date < String(Date().formatted(.iso8601.year().month().day()))
        } else {
            dueLabel = "This week"
            isOverdue = false
        }
    }
}

struct PipelineEntry: Decodable, Equatable, Identifiable {
    let id: String
    let company: String
    let role: String
    let stage: String
    let followUp: String?

    init(id: String, company: String, role: String, stage: String, followUp: String?) {
        self.id = id
        self.company = company
        self.role = role
        self.stage = stage
        self.followUp = followUp
    }

    private enum CodingKeys: String, CodingKey { case id, company = "Company", role = "Role", stage = "Stage", followUp = "Follow-Up" }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        company = try values.decodeIfPresent(String.self, forKey: .company) ?? ""
        role = try values.decodeIfPresent(String.self, forKey: .role) ?? ""
        stage = try values.decodeIfPresent(String.self, forKey: .stage) ?? "Research"
        followUp = try values.decodeIfPresent(String.self, forKey: .followUp)
    }
}

struct NextAction: Codable, Equatable {
    let title: String
    let detail: String
    let route: String
}
