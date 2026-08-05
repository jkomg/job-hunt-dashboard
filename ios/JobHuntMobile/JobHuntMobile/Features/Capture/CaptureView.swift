import SwiftUI

struct CaptureView: View {
    @EnvironmentObject private var appModel: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var sourceText: String
    private let initialURL: URL?
    @State private var draft: JobDraft?
    @State private var isExtracting = false

    init(initialText: String = "", initialURL: URL? = nil) {
        _sourceText = State(initialValue: initialText)
        self.initialURL = initialURL
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Paste or share a job posting") {
                    TextEditor(text: $sourceText)
                        .frame(minHeight: 160)
                    Text("The original text is retained so you can verify every suggested field.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Section {
                    Button { extract() } label: {
                        if isExtracting { ProgressView() } else { Label("Extract draft", systemImage: "wand.and.stars") }
                    }
                    .disabled(sourceText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isExtracting)
                }
            }
            .navigationTitle("Capture")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .sheet(item: $draft) { ReviewView(draft: $0) }
        }
    }

    private func extract() {
        isExtracting = true
        Task {
            let result = await FallbackJobExtractor().extract(from: sourceText, sharedURL: initialURL)
            await MainActor.run { draft = result; isExtracting = false }
        }
    }
}

struct ReviewView: View {
    @EnvironmentObject private var appModel: AppModel
    @Environment(\.dismiss) private var dismiss
    @State var draft: JobDraft
    @State private var saved = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Review before saving") {
                    TextField("Company", text: $draft.company)
                    TextField("Role", text: $draft.role)
                    TextField("Job URL", text: $draft.url)
                    TextField("Location", text: $draft.location)
                    TextField("Skills", text: Binding(get: { draft.skills.joined(separator: ", ") }, set: { draft.skills = $0.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) } }))
                    TextField("Notes", text: $draft.notes, axis: .vertical)
                }
                Section("Original source") { Text(draft.sourceText).font(.caption) }
                Section {
                    Button("Confirm and save") { save() }.buttonStyle(.borderedProminent)
                }
            }
            .navigationTitle("Confirm Job")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Discard") { dismiss() } } }
            .alert("Saved locally", isPresented: $saved) { Button("Done") { dismiss() } } message: { Text("The job is queued for the hosted pipeline when sync is connected.") }
        }
    }

    private func save() {
        Task { await appModel.store.save(draft); await MainActor.run { saved = true } }
    }
}
