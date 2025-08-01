import { KanbanRenderer } from "@web/views/kanban/kanban_renderer";
import { UploadDropZone } from "@account/components/upload_drop_zone/upload_drop_zone";
import { useState } from "@cashapp/owl";
import { uploadFileFromData } from "../upload_file_from_data_hook";

export class FileUploadKanbanRenderer extends KanbanRenderer {
    static template = "account.FileUploadKanbanRenderer";
    static components = {
        ...KanbanRenderer.components,
        UploadDropZone,
    };

    setup() {
        super.setup();
        this.dropzoneState = useState({ visible: false });
        this.uploadFileFromData = uploadFileFromData();
    }

    async onPaste(ev) {
        if (!ev.clipboardData?.items) {
            return;
        }
        ev.preventDefault();
        this.uploadFileFromData(ev.clipboardData);
    }

    onDragStart(ev) {
        if (ev.dataTransfer.types.includes("Files")) {
            this.dropzoneState.visible = true;
        }
    }
}
