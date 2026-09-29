import Foundation

actor LocalDraftStore {
    private var drafts: [JobDraft] = []

    func save(_ draft: JobDraft) { drafts.append(draft) }
    func all() -> [JobDraft] { drafts }
}
