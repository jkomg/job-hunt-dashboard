import SwiftUI

struct PipelineView: View {
    @EnvironmentObject private var appModel: AppModel
    @State private var entries: [PipelineEntry] = [
        PipelineEntry(id: "demo-1", company: "Acme", role: "Senior Product Designer", stage: "Follow-up", followUp: "Today"),
        PipelineEntry(id: "demo-2", company: "Northstar", role: "Product Lead", stage: "Interview", followUp: "Tomorrow")
    ]

    var body: some View {
        NavigationStack {
            List(entries) { entry in
                VStack(alignment: .leading, spacing: 4) {
                    Text(entry.role).font(.headline)
                    Text(entry.company).foregroundStyle(.secondary)
                    HStack { Text(entry.stage).font(.caption.bold()); if let followUp = entry.followUp { Text("· \(followUp)").font(.caption).foregroundStyle(.secondary) } }
                }
                .padding(.vertical, 4)
            }
            .navigationTitle("Pipeline")
            .toolbar { Button { Task { await refresh() } } label: { Image(systemName: "arrow.clockwise") } }
        }
    }

    private func refresh() async {
        if let remote = try? await appModel.api.pipeline(), !remote.isEmpty { entries = remote }
    }
}
