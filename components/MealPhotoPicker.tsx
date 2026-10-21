import { useRef, type ChangeEvent } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Camera, Images } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";

export type MealPhoto = {
  imageBase64: string;
  mimeType: string;
  uri: string;
};

type Props = {
  disabled?: boolean;
  onPhoto: (photo: MealPhoto) => void;
  onError: (message: string) => void;
};

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export default function MealPhotoPicker({ disabled = false, onPhoto, onError }: Props) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);

  async function handleWebFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      if (!file.type.startsWith("image/")) throw new Error("Odabrana datoteka nije slika.");
      if (file.size > MAX_IMAGE_BYTES) throw new Error("Slika može imati najviše 6 MB.");
      const dataUrl = await readFileAsDataUrl(file);
      const separator = dataUrl.indexOf(",");
      if (separator < 0) throw new Error("Sliku nije moguće pročitati. Pokušaj s drugom slikom.");
      onPhoto({
        imageBase64: dataUrl.slice(separator + 1),
        mimeType: file.type || "image/jpeg",
        uri: dataUrl
      });
    } catch (error) {
      onError(error instanceof Error ? error.message : "Sliku nije moguće učitati.");
    }
  }

  async function pickNativeImage(useCamera: boolean) {
    try {
      if (useCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          onError("Dozvoli pristup kameri u postavkama uređaja da fotografišeš obrok.");
          return;
        }
      }
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], base64: true, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.8 });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) throw new Error("Sliku nije moguće pročitati. Pokušaj s drugom slikom.");
      if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) throw new Error("Slika može imati najviše 6 MB.");
      onPhoto({
        imageBase64: asset.base64,
        mimeType: asset.mimeType ?? "image/jpeg",
        uri: asset.uri
      });
    } catch (error) {
      onError(error instanceof Error ? error.message : "Sliku nije moguće učitati.");
    }
  }

  function openWebInput(input: HTMLInputElement | null) {
    input?.click();
  }

  return (
    <View className="mt-3 gap-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Slikaj obrok uz AI"
        disabled={disabled}
        onPress={() => Platform.OS === "web" ? openWebInput(cameraInput.current) : void pickNativeImage(true)}
        className={`overflow-hidden rounded-2xl ${disabled ? "opacity-50" : ""}`}
        style={{ shadowColor: "#E60023", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 9, elevation: 3 }}
      >
        <LinearGradient colors={["#FF3B30", "#FF6B00"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} className="flex-row items-center justify-center gap-3 px-4 py-4">
          <Camera size={19} color="white" />
          <Text className="font-bold text-white">Slikaj obrok uz AI</Text>
        </LinearGradient>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Odaberi sliku obroka"
        disabled={disabled}
        onPress={() => Platform.OS === "web" ? openWebInput(libraryInput.current) : void pickNativeImage(false)}
        className={`flex-row items-center justify-center gap-3 rounded-2xl border border-[#F0F0F3] bg-white px-4 py-4 ${disabled ? "opacity-50" : ""}`}
      >
        <Images size={19} color="#FF2D55" />
        <Text className="font-bold text-ink">Odaberi fotografiju</Text>
      </Pressable>
      {Platform.OS === "web" && (
        <>
          {createInput(cameraInput, handleWebFile, true)}
          {createInput(libraryInput, handleWebFile, false)}
        </>
      )}
    </View>
  );
}

function createInput(
  ref: React.RefObject<HTMLInputElement | null>,
  onChange: (event: ChangeEvent<HTMLInputElement>) => void,
  capture: boolean
) {
  return (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      capture={capture ? "environment" : undefined}
      onChange={onChange}
      aria-label={capture ? "Fotografiši obrok" : "Odaberi sliku obroka"}
      style={{ display: "none" }}
    />
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Sliku nije moguće pročitati."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Sliku nije moguće pročitati."));
    reader.readAsDataURL(file);
  });
}
